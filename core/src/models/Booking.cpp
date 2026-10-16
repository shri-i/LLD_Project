#include "models/Booking.hpp"

#include <utility>

namespace bookmyshow {

Booking::Booking(std::string id, std::string userId, std::string showId,
                 std::vector<std::string> seatIds, double totalAmount,
                 Clock::time_point holdExpiry)
    : id_(std::move(id)),
      userId_(std::move(userId)),
      showId_(std::move(showId)),
      seatIds_(std::move(seatIds)),
      totalAmount_(totalAmount),
      holdExpiry_(holdExpiry),
      createdAt_(std::chrono::system_clock::now()) {}

bool Booking::canTransition(BookingStatus from, BookingStatus to) {
    switch (from) {
        case BookingStatus::PENDING:
            return to == BookingStatus::CONFIRMED || to == BookingStatus::CANCELLED ||
                   to == BookingStatus::EXPIRED;
        case BookingStatus::CONFIRMED:
            return to == BookingStatus::CANCELLED;
        case BookingStatus::CANCELLED:
        case BookingStatus::EXPIRED:
            return false;  // final states
    }
    return false;
}

bool Booking::transitionTo(BookingStatus next) {
    if (!canTransition(status_, next)) {
        return false;
    }
    status_ = next;
    return true;
}

bool Booking::isHoldExpired(Clock::time_point now) const {
    return status_ == BookingStatus::PENDING && now >= holdExpiry_;
}

}  // namespace bookmyshow
