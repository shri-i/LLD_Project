#include "services/BookingService.hpp"

#include "payment/PaymentFactory.hpp"

#include <atomic>
#include <stdexcept>
#include <utility>

namespace bookmyshow {
namespace {

std::atomic<unsigned long> nextBookingId{0};
std::atomic<unsigned long> nextPaymentId{0};

const char* const kHoldExpiredReason = "Seat lock expired; the booking has expired";

}  // namespace

BookingService::BookingService(SeatLockManager& seatLockManager,
                               NotificationService& notificationService,
                               const PricingEngine& pricingEngine,
                               std::shared_ptr<const RefundPolicy> refundPolicy)
    : seatLockManager_(seatLockManager),
      notificationService_(notificationService),
      pricingEngine_(pricingEngine),
      refundPolicy_(std::move(refundPolicy)) {
    if (!refundPolicy_) {
        throw std::invalid_argument("BookingService needs a refund policy");
    }
}

CreateBookingResult BookingService::createBooking(const std::string& showId,
                                                  const std::vector<std::string>& seatIds,
                                                  const std::string& userId) {
    if (showId.empty() || userId.empty() || seatIds.empty()) {
        return {false, {}, "showId, userId, and seatIds are required"};
    }
    const auto show = seatLockManager_.getShow(showId);
    if (!show) {
        return {false, {}, "Show not found"};
    }
    // The booking lives exactly as long as the user's hold on the seats.
    const auto holdExpiry = show->holdExpiry(seatIds, userId);
    if (!holdExpiry) {
        return {false, {}, "Seats are not locked by this user"};
    }

    double total = 0.0;
    for (const auto& seatId : seatIds) {
        const auto seat = show->findSeat(seatId);
        if (!seat) {
            return {false, {}, "Seat not found"};
        }
        total += pricingEngine_.priceFor(seat->basePrice, seat->seat.type, show->startTime(),
                                         show->utcOffsetMinutes());
    }

    Booking booking("booking-" + std::to_string(++nextBookingId), userId, showId, seatIds,
                    total, *holdExpiry);
    std::lock_guard<std::mutex> lock(mutex_);
    bookings_.emplace(booking.id(), booking);
    return {true, booking, {}};
}

ConfirmBookingResult BookingService::confirmBooking(const std::string& bookingId,
                                                    PaymentMode mode) {
    Booking confirmedBooking;
    Payment payment;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        const auto bookingIt = bookings_.find(bookingId);
        if (bookingIt == bookings_.end()) {
            return {false, {}, "Booking not found"};
        }
        Booking& booking = bookingIt->second;
        // Check the hold before charging, so an expired booking is never paid for.
        if (booking.isHoldExpired(Booking::Clock::now())) {
            booking.transitionTo(BookingStatus::EXPIRED);
            return {false, {}, kHoldExpiredReason};
        }
        if (!Booking::canTransition(booking.status(), BookingStatus::CONFIRMED)) {
            return {false, {}, "Booking is not pending"};
        }

        payment.id = "payment-" + std::to_string(++nextPaymentId);
        payment.bookingId = bookingId;
        payment.mode = mode;
        payment.amount = booking.totalAmount();
        payment.createdAt = std::chrono::system_clock::now();
        if (!PaymentFactory::create(mode)->pay(payment.amount)) {
            payment.status = PaymentStatus::FAILED;
            payments_[bookingId] = payment;
            return {false, payment, "Payment failed"};
        }
        if (!seatLockManager_.confirmSeats(booking.showId(), booking.seatIds(),
                                           booking.userId())) {
            // The hold ran out while paying: the charge is reversed.
            payment.status = PaymentStatus::REFUNDED;
            payments_[bookingId] = payment;
            booking.transitionTo(BookingStatus::EXPIRED);
            return {false, payment, kHoldExpiredReason};
        }

        payment.status = PaymentStatus::SUCCESS;
        payments_[bookingId] = payment;
        booking.transitionTo(BookingStatus::CONFIRMED);
        confirmedBooking = booking;
    }
    notificationService_.notify(confirmedBooking, "confirmed");
    return {true, payment, {}};
}

CancelBookingResult BookingService::cancelBooking(const std::string& bookingId) {
    Booking cancelledBooking;
    CancelBookingResult result;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        const auto bookingIt = bookings_.find(bookingId);
        if (bookingIt == bookings_.end()) {
            return {false, 0.0, "Booking not found"};
        }
        Booking& booking = bookingIt->second;
        if (booking.isHoldExpired(Booking::Clock::now())) {
            booking.transitionTo(BookingStatus::EXPIRED);
        }
        if (!Booking::canTransition(booking.status(), BookingStatus::CANCELLED)) {
            return {false, 0.0, "Booking is already closed"};
        }

        if (booking.status() == BookingStatus::CONFIRMED) {
            const auto show = seatLockManager_.getShow(booking.showId());
            if (!show) {
                return {false, 0.0, "Show not found"};
            }
            const auto decision = refundFor(*show, booking.totalAmount());
            if (!decision.allowed) {
                return {false, 0.0, decision.reason};
            }
            if (!show->releaseSeats(booking.seatIds())) {
                return {false, 0.0, "Could not release confirmed seats"};
            }
            const auto paymentIt = payments_.find(bookingId);
            if (paymentIt != payments_.end() && decision.amount > 0.0) {
                paymentIt->second.status = PaymentStatus::REFUNDED;
            }
            result.refundAmount = decision.amount;
        } else {
            seatLockManager_.unlockSeats(booking.showId(), booking.seatIds(), booking.userId());
        }
        booking.transitionTo(BookingStatus::CANCELLED);
        cancelledBooking = booking;
    }
    notificationService_.notify(cancelledBooking, "cancelled");
    result.ok = true;
    return result;
}

RefundDecision BookingService::quoteRefund(const std::string& showId, double paidAmount) const {
    const auto show = seatLockManager_.getShow(showId);
    if (!show) {
        return {false, 0.0, "Show not found"};
    }
    return refundFor(*show, paidAmount);
}

RefundDecision BookingService::refundFor(const Show& show, double paidAmount) const {
    return refundPolicy_->evaluate(paidAmount,
                                   show.startTime() - std::chrono::system_clock::now());
}

std::size_t BookingService::expireStaleBookings() {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto now = Booking::Clock::now();
    std::size_t expired = 0;
    for (auto& entry : bookings_) {
        if (entry.second.isHoldExpired(now) &&
            entry.second.transitionTo(BookingStatus::EXPIRED)) {
            ++expired;
        }
    }
    return expired;
}

std::optional<Booking> BookingService::getBooking(const std::string& bookingId) const {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto bookingIt = bookings_.find(bookingId);
    if (bookingIt == bookings_.end()) {
        return std::nullopt;
    }
    return bookingIt->second;
}

}  // namespace bookmyshow
