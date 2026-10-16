#pragma once

#include "models/Show.hpp"

#include <chrono>
#include <condition_variable>
#include <cstddef>
#include <memory>
#include <mutex>
#include <optional>
#include <shared_mutex>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

namespace bookmyshow {

// Singleton registry of live shows plus the background thread that expires
// seat holds. Locking happens at two levels:
//   1. registryMutex_ (reader/writer): many requests can look shows up at once;
//      only registering/removing a show takes the exclusive lock.
//   2. Show's own mutex: serialises seat changes within one show only.
// A request holds at most one show lock at a time, so it cannot deadlock.
class SeatLockManager {
public:
    using Clock = ShowSeat::Clock;

    static SeatLockManager& getInstance();

    SeatLockManager(const SeatLockManager&) = delete;
    SeatLockManager& operator=(const SeatLockManager&) = delete;
    ~SeatLockManager();

    bool registerShow(const std::shared_ptr<Show>& show);
    bool unregisterShow(const std::string& showId);
    std::shared_ptr<Show> getShow(const std::string& showId) const;

    bool lockSeats(const std::string& showId, const std::vector<std::string>& seatIds,
                   const std::string& userId, Clock::duration ttl);
    bool unlockSeats(const std::string& showId, const std::vector<std::string>& seatIds,
                     const std::string& userId);
    std::optional<Clock::time_point> holdExpiry(const std::string& showId,
                                                const std::vector<std::string>& seatIds,
                                                const std::string& userId) const;
    bool confirmSeats(const std::string& showId, const std::vector<std::string>& seatIds,
                      const std::string& userId);
    bool cancelConfirmedSeats(const std::string& showId,
                              const std::vector<std::string>& seatIds);
    std::size_t releaseExpiredLocks();

    bool startExpiryThread(std::chrono::milliseconds interval);
    void stopExpiryThread();

private:
    SeatLockManager() = default;

    mutable std::shared_mutex registryMutex_;
    std::unordered_map<std::string, std::shared_ptr<Show>> shows_;

    std::mutex workerMutex_;
    std::mutex workerLifecycleMutex_;
    std::condition_variable workerCondition_;
    std::thread expiryThread_;
    bool stopRequested_{false};
};

}  // namespace bookmyshow
