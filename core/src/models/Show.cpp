#include "models/Show.hpp"

#include <algorithm>
#include <unordered_set>
#include <utility>

namespace bookmyshow {
namespace {

SeatView viewOf(const ShowSeat& seat, ShowSeat::Clock::time_point now) {
    return SeatView{seat.seat(), seat.statusAt(now), seat.basePrice()};
}

// Shared by the const and non-const resolve(); Seats is (const) vector<ShowSeat>.
template <typename Seats>
auto resolveIn(Seats& seats, const std::unordered_map<std::string, std::size_t>& indexById,
               const std::vector<std::string>& seatIds) {
    std::vector<decltype(&seats.front())> resolved;
    std::unordered_set<std::string> seen;
    resolved.reserve(seatIds.size());
    for (const auto& seatId : seatIds) {
        const auto it = indexById.find(seatId);
        if (it == indexById.end() || !seen.insert(seatId).second) {
            return decltype(resolved){};
        }
        resolved.push_back(&seats[it->second]);
    }
    return resolved;
}

}  // namespace

Show::Show(std::string id, std::string movieId, std::string screenId, SystemTime startTime,
           double basePrice, int utcOffsetMinutes)
    : id_(std::move(id)),
      movieId_(std::move(movieId)),
      screenId_(std::move(screenId)),
      startTime_(startTime),
      basePrice_(basePrice),
      utcOffsetMinutes_(utcOffsetMinutes) {}

bool Show::addSeat(ShowSeat seat) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (seat.id().empty() || indexById_.count(seat.id()) != 0) {
        return false;
    }
    indexById_.emplace(seat.id(), seats_.size());
    seats_.push_back(std::move(seat));
    return true;
}

std::size_t Show::seatCount() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return seats_.size();
}

std::vector<SeatView> Show::seatMap() const {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto now = Clock::now();
    std::vector<SeatView> views;
    views.reserve(seats_.size());
    for (const auto& seat : seats_) {
        views.push_back(viewOf(seat, now));
    }
    return views;
}

std::vector<SeatView> Show::availableSeats() const {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto now = Clock::now();
    std::vector<SeatView> views;
    for (const auto& seat : seats_) {
        if (seat.canLock(now)) {
            views.push_back(viewOf(seat, now));
        }
    }
    return views;
}

std::optional<SeatView> Show::findSeat(const std::string& seatId) const {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto it = indexById_.find(seatId);
    if (it == indexById_.end()) {
        return std::nullopt;
    }
    return viewOf(seats_[it->second], Clock::now());
}

bool Show::lockSeats(const std::vector<std::string>& seatIds, const std::string& userId,
                     Clock::duration ttl) {
    if (userId.empty() || ttl <= Clock::duration::zero()) {
        return false;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    const auto seats = resolve(seatIds);
    const auto now = Clock::now();
    // Phase 1: check every seat. Phase 2: commit. No partial state is ever
    // visible, so there is nothing to roll back.
    const bool allFree = std::all_of(seats.begin(), seats.end(),
                                     [now](const ShowSeat* seat) { return seat->canLock(now); });
    if (seats.empty() || !allFree) {
        return false;
    }
    for (auto* seat : seats) {
        seat->tryLock(userId, now + ttl, now);
    }
    return true;
}

bool Show::unlockSeats(const std::vector<std::string>& seatIds, const std::string& userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto seats = resolve(seatIds);
    if (seats.empty()) {
        return false;
    }
    bool allUnlocked = true;
    for (auto* seat : seats) {
        allUnlocked = seat->unlock(userId) && allUnlocked;
    }
    return allUnlocked;
}

bool Show::confirmSeats(const std::vector<std::string>& seatIds, const std::string& userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto seats = resolve(seatIds);
    const auto now = Clock::now();
    if (seats.empty() || !std::all_of(seats.begin(), seats.end(), [&](const ShowSeat* seat) {
            return seat->isHeldBy(userId, now);
        })) {
        return false;
    }
    for (auto* seat : seats) {
        seat->confirm(userId, now);
    }
    return true;
}

bool Show::releaseSeats(const std::vector<std::string>& seatIds) {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto seats = resolve(seatIds);
    const auto now = Clock::now();
    if (seats.empty() || !std::all_of(seats.begin(), seats.end(), [now](const ShowSeat* seat) {
            return seat->statusAt(now) == SeatStatus::BOOKED;
        })) {
        return false;
    }
    for (auto* seat : seats) {
        seat->release();
    }
    return true;
}

std::optional<Show::Clock::time_point> Show::holdExpiry(
    const std::vector<std::string>& seatIds, const std::string& userId) const {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto seats = resolve(seatIds);
    const auto now = Clock::now();
    if (seats.empty()) {
        return std::nullopt;
    }
    auto earliest = Clock::time_point::max();
    for (const auto* seat : seats) {
        if (!seat->isHeldBy(userId, now)) {
            return std::nullopt;
        }
        earliest = std::min(earliest, seat->lockExpiry());
    }
    return earliest;
}

std::size_t Show::releaseExpiredLocks() {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto now = Clock::now();
    std::size_t released = 0;
    for (auto& seat : seats_) {
        if (seat.releaseIfExpired(now)) {
            ++released;
        }
    }
    return released;
}

std::size_t Show::heldSeatCount() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return static_cast<std::size_t>(std::count_if(
        seats_.begin(), seats_.end(), [](const ShowSeat& seat) { return seat.hasHold(); }));
}

std::vector<ShowSeat*> Show::resolve(const std::vector<std::string>& seatIds) {
    return resolveIn(seats_, indexById_, seatIds);
}

std::vector<const ShowSeat*> Show::resolve(const std::vector<std::string>& seatIds) const {
    return resolveIn(seats_, indexById_, seatIds);
}

}  // namespace bookmyshow
