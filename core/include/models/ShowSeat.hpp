#pragma once

#include "enums/Enums.hpp"
#include "models/Seat.hpp"

#include <chrono>
#include <string>

namespace bookmyshow {

// A physical seat in the context of one show, modelled as a state machine:
//
//   AVAILABLE --tryLock--> LOCKED --confirm--> BOOKED
//       ^                    |                   |
//       +---unlock/expiry----+                   |
//       +-----------------release----------------+
//
// All state is private and changes only through these transitions.
// ShowSeat is not thread-safe on its own: the owning Show serialises access.
class ShowSeat {
public:
    using Clock = std::chrono::steady_clock;

    ShowSeat(Seat seat, double basePrice, SeatStatus status = SeatStatus::AVAILABLE);

    const Seat& seat() const { return seat_; }
    const std::string& id() const { return seat_.id; }
    double basePrice() const { return basePrice_; }

    // Status as seen at `now`: a hold whose TTL has passed reads as AVAILABLE.
    SeatStatus statusAt(Clock::time_point now) const;
    bool isHeldBy(const std::string& userId, Clock::time_point now) const;
    Clock::time_point lockExpiry() const { return lockExpiry_; }
    // True until the hold is cleared, even if its TTL has already passed.
    bool hasHold() const { return status_ == SeatStatus::LOCKED; }

    bool canLock(Clock::time_point now) const;
    bool tryLock(const std::string& userId, Clock::time_point expiry, Clock::time_point now);
    bool unlock(const std::string& userId);
    bool confirm(const std::string& userId, Clock::time_point now);
    bool release();  // BOOKED -> AVAILABLE (booking cancelled)
    bool releaseIfExpired(Clock::time_point now);

private:
    void clearHold();

    Seat seat_;
    double basePrice_;
    SeatStatus status_;
    std::string lockedByUserId_;
    Clock::time_point lockExpiry_{};
};

}  // namespace bookmyshow
