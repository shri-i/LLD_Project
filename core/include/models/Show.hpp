#pragma once

#include "models/ShowSeat.hpp"

#include <chrono>
#include <cstddef>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace bookmyshow {

// Read-only copy of one seat, safe to use after the show's lock is released.
struct SeatView {
    Seat seat;
    SeatStatus status;
    double basePrice;
};

// One screening of a movie on a screen. Show is the aggregate root for its
// seats: every seat change goes through Show, under one per-show mutex, so a
// multi-seat request is atomic (check every seat first, then change them all).
// Requests for different shows never contend with each other.
class Show {
public:
    using Clock = ShowSeat::Clock;
    using SystemTime = std::chrono::system_clock::time_point;

    Show(std::string id, std::string movieId, std::string screenId, SystemTime startTime,
         double basePrice, int utcOffsetMinutes = 330);

    Show(const Show&) = delete;
    Show& operator=(const Show&) = delete;

    const std::string& id() const { return id_; }
    const std::string& movieId() const { return movieId_; }
    const std::string& screenId() const { return screenId_; }
    SystemTime startTime() const { return startTime_; }
    double basePrice() const { return basePrice_; }
    int utcOffsetMinutes() const { return utcOffsetMinutes_; }

    // Adds a seat while the show is being built; false for an empty/duplicate id.
    bool addSeat(ShowSeat seat);
    std::size_t seatCount() const;

    std::vector<SeatView> seatMap() const;
    std::vector<SeatView> availableSeats() const;
    std::optional<SeatView> findSeat(const std::string& seatId) const;

    // All-or-nothing: either every requested seat changes state or none does.
    bool lockSeats(const std::vector<std::string>& seatIds, const std::string& userId,
                   Clock::duration ttl);
    bool unlockSeats(const std::vector<std::string>& seatIds, const std::string& userId);
    bool confirmSeats(const std::vector<std::string>& seatIds, const std::string& userId);
    bool releaseSeats(const std::vector<std::string>& seatIds);

    // Earliest hold expiry if `userId` currently holds every seat, else nullopt.
    std::optional<Clock::time_point> holdExpiry(const std::vector<std::string>& seatIds,
                                                const std::string& userId) const;
    std::size_t releaseExpiredLocks();
    // Seats still marked held, including expired holds not yet cleaned up.
    std::size_t heldSeatCount() const;

private:
    // Resolves ids to seats; empty if any id is unknown, empty or duplicated.
    std::vector<ShowSeat*> resolve(const std::vector<std::string>& seatIds);
    std::vector<const ShowSeat*> resolve(const std::vector<std::string>& seatIds) const;

    std::string id_;
    std::string movieId_;
    std::string screenId_;
    SystemTime startTime_;
    double basePrice_;
    int utcOffsetMinutes_;

    mutable std::mutex mutex_;
    std::vector<ShowSeat> seats_;                          // display order
    std::unordered_map<std::string, std::size_t> indexById_;  // O(1) lookup
};

}  // namespace bookmyshow
