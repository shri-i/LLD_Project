#include "models/ShowSeat.hpp"

#include <utility>

namespace bookmyshow {

ShowSeat::ShowSeat(Seat seat, double basePrice, SeatStatus status)
    : seat_(std::move(seat)), basePrice_(basePrice), status_(status) {
    // A seat can be loaded as AVAILABLE or BOOKED; a hold always needs an owner.
    if (status_ == SeatStatus::LOCKED) {
        status_ = SeatStatus::AVAILABLE;
    }
}

SeatStatus ShowSeat::statusAt(Clock::time_point now) const {
    if (status_ == SeatStatus::LOCKED && now >= lockExpiry_) {
        return SeatStatus::AVAILABLE;
    }
    return status_;
}

bool ShowSeat::isHeldBy(const std::string& userId, Clock::time_point now) const {
    return statusAt(now) == SeatStatus::LOCKED && lockedByUserId_ == userId;
}

bool ShowSeat::canLock(Clock::time_point now) const {
    return statusAt(now) == SeatStatus::AVAILABLE;
}

bool ShowSeat::tryLock(const std::string& userId, Clock::time_point expiry,
                       Clock::time_point now) {
    if (userId.empty() || expiry <= now || !canLock(now)) {
        return false;
    }
    status_ = SeatStatus::LOCKED;
    lockedByUserId_ = userId;
    lockExpiry_ = expiry;
    return true;
}

bool ShowSeat::unlock(const std::string& userId) {
    if (status_ != SeatStatus::LOCKED || lockedByUserId_ != userId) {
        return false;
    }
    clearHold();
    return true;
}

bool ShowSeat::confirm(const std::string& userId, Clock::time_point now) {
    if (!isHeldBy(userId, now)) {
        return false;
    }
    clearHold();
    status_ = SeatStatus::BOOKED;
    return true;
}

bool ShowSeat::release() {
    if (status_ != SeatStatus::BOOKED) {
        return false;
    }
    status_ = SeatStatus::AVAILABLE;
    return true;
}

bool ShowSeat::releaseIfExpired(Clock::time_point now) {
    if (status_ != SeatStatus::LOCKED || now < lockExpiry_) {
        return false;
    }
    clearHold();
    return true;
}

void ShowSeat::clearHold() {
    status_ = SeatStatus::AVAILABLE;
    lockedByUserId_.clear();
    lockExpiry_ = Clock::time_point{};
}

}  // namespace bookmyshow
