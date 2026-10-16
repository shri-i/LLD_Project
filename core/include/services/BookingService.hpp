#pragma once

#include "models/Booking.hpp"
#include "models/Payment.hpp"
#include "pricing/PricingEngine.hpp"
#include "refund/RefundPolicy.hpp"
#include "services/NotificationService.hpp"
#include "services/SeatLockManager.hpp"

#include <cstddef>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace bookmyshow {

struct CreateBookingResult {
    bool ok{false};
    Booking booking;
    std::string reason;
};

struct ConfirmBookingResult {
    bool ok{false};
    Payment payment;
    std::string reason;
};

struct CancelBookingResult {
    bool ok{false};
    double refundAmount{0.0};
    std::string reason;
};

// Orchestrates the booking use cases: hold -> booking -> payment -> confirm,
// and cancellation with refunds. Collaborators are injected (Dependency
// Inversion), so pricing rules and refund policy can be swapped without
// touching this class.
class BookingService {
public:
    BookingService(SeatLockManager& seatLockManager, NotificationService& notificationService,
                   const PricingEngine& pricingEngine,
                   std::shared_ptr<const RefundPolicy> refundPolicy);

    CreateBookingResult createBooking(const std::string& showId,
                                      const std::vector<std::string>& seatIds,
                                      const std::string& userId);
    ConfirmBookingResult confirmBooking(const std::string& bookingId, PaymentMode mode);
    CancelBookingResult cancelBooking(const std::string& bookingId);

    // Refund the policy allows for `paidAmount` on this show, right now.
    RefundDecision quoteRefund(const std::string& showId, double paidAmount) const;

    // Moves PENDING bookings whose seat hold ran out to EXPIRED.
    std::size_t expireStaleBookings();
    std::optional<Booking> getBooking(const std::string& bookingId) const;

private:
    RefundDecision refundFor(const Show& show, double paidAmount) const;

    SeatLockManager& seatLockManager_;
    NotificationService& notificationService_;
    const PricingEngine& pricingEngine_;
    std::shared_ptr<const RefundPolicy> refundPolicy_;

    mutable std::mutex mutex_;
    std::unordered_map<std::string, Booking> bookings_;
    std::unordered_map<std::string, Payment> payments_;
};

}  // namespace bookmyshow
