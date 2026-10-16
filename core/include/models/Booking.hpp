#pragma once

#include "enums/Enums.hpp"

#include <chrono>
#include <string>
#include <vector>

namespace bookmyshow {

// A booking and its lifecycle, modelled as an explicit state machine:
//
//   PENDING --pay--> CONFIRMED --cancel--> CANCELLED
//      |                                      ^
//      +------------------cancel--------------+
//      +--seat hold runs out--> EXPIRED
//
// CANCELLED and EXPIRED are final. Any other move is rejected by transitionTo().
class Booking {
public:
    using Clock = std::chrono::steady_clock;

    Booking() = default;
    Booking(std::string id, std::string userId, std::string showId,
            std::vector<std::string> seatIds, double totalAmount, Clock::time_point holdExpiry);

    const std::string& id() const { return id_; }
    const std::string& userId() const { return userId_; }
    const std::string& showId() const { return showId_; }
    const std::vector<std::string>& seatIds() const { return seatIds_; }
    double totalAmount() const { return totalAmount_; }
    BookingStatus status() const { return status_; }
    std::chrono::system_clock::time_point createdAt() const { return createdAt_; }

    static bool canTransition(BookingStatus from, BookingStatus to);
    bool transitionTo(BookingStatus next);

    // A pending booking expires together with its seat hold.
    bool isHoldExpired(Clock::time_point now) const;

private:
    std::string id_;
    std::string userId_;
    std::string showId_;
    std::vector<std::string> seatIds_;
    double totalAmount_{0.0};
    BookingStatus status_{BookingStatus::PENDING};
    Clock::time_point holdExpiry_{};
    std::chrono::system_clock::time_point createdAt_{};
};

}  // namespace bookmyshow
