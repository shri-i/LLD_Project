#include "services/SeatLockManager.hpp"

namespace bookmyshow {

SeatLockManager& SeatLockManager::getInstance() {
    // Function-local static: initialised once, thread-safe since C++11.
    static SeatLockManager instance;
    return instance;
}

SeatLockManager::~SeatLockManager() {
    stopExpiryThread();
}

bool SeatLockManager::registerShow(const std::shared_ptr<Show>& show) {
    if (!show || show->id().empty() || show->seatCount() == 0) {
        return false;
    }
    std::unique_lock<std::shared_mutex> lock(registryMutex_);
    return shows_.emplace(show->id(), show).second;
}

bool SeatLockManager::unregisterShow(const std::string& showId) {
    std::unique_lock<std::shared_mutex> lock(registryMutex_);
    return shows_.erase(showId) != 0;
}

std::shared_ptr<Show> SeatLockManager::getShow(const std::string& showId) const {
    std::shared_lock<std::shared_mutex> lock(registryMutex_);
    const auto it = shows_.find(showId);
    return it == shows_.end() ? nullptr : it->second;
}

// Each operation looks the show up under the shared registry lock, releases it,
// then works under that show's own lock. The shared_ptr keeps the show alive
// even if it is unregistered meanwhile.
bool SeatLockManager::lockSeats(const std::string& showId,
                                const std::vector<std::string>& seatIds,
                                const std::string& userId, Clock::duration ttl) {
    const auto show = getShow(showId);
    return show && show->lockSeats(seatIds, userId, ttl);
}

bool SeatLockManager::unlockSeats(const std::string& showId,
                                  const std::vector<std::string>& seatIds,
                                  const std::string& userId) {
    const auto show = getShow(showId);
    return show && show->unlockSeats(seatIds, userId);
}

std::optional<SeatLockManager::Clock::time_point> SeatLockManager::holdExpiry(
    const std::string& showId, const std::vector<std::string>& seatIds,
    const std::string& userId) const {
    const auto show = getShow(showId);
    return show ? show->holdExpiry(seatIds, userId) : std::nullopt;
}

bool SeatLockManager::confirmSeats(const std::string& showId,
                                   const std::vector<std::string>& seatIds,
                                   const std::string& userId) {
    const auto show = getShow(showId);
    return show && show->confirmSeats(seatIds, userId);
}

bool SeatLockManager::cancelConfirmedSeats(const std::string& showId,
                                           const std::vector<std::string>& seatIds) {
    const auto show = getShow(showId);
    return show && show->releaseSeats(seatIds);
}

std::size_t SeatLockManager::releaseExpiredLocks() {
    std::vector<std::shared_ptr<Show>> shows;
    {
        std::shared_lock<std::shared_mutex> lock(registryMutex_);
        shows.reserve(shows_.size());
        for (const auto& entry : shows_) {
            shows.push_back(entry.second);
        }
    }
    std::size_t released = 0;
    for (const auto& show : shows) {
        released += show->releaseExpiredLocks();
    }
    return released;
}

bool SeatLockManager::startExpiryThread(std::chrono::milliseconds interval) {
    if (interval <= std::chrono::milliseconds::zero()) {
        return false;
    }

    std::lock_guard<std::mutex> lifecycleLock(workerLifecycleMutex_);
    std::lock_guard<std::mutex> lock(workerMutex_);
    if (expiryThread_.joinable()) {
        return false;
    }
    stopRequested_ = false;
    expiryThread_ = std::thread([this, interval]() {
        std::unique_lock<std::mutex> workerLock(workerMutex_);
        while (!workerCondition_.wait_for(workerLock, interval,
                                          [this]() { return stopRequested_; })) {
            workerLock.unlock();
            releaseExpiredLocks();
            workerLock.lock();
        }
    });
    return true;
}

void SeatLockManager::stopExpiryThread() {
    std::lock_guard<std::mutex> lifecycleLock(workerLifecycleMutex_);
    {
        std::lock_guard<std::mutex> lock(workerMutex_);
        if (!expiryThread_.joinable()) {
            return;
        }
        stopRequested_ = true;
    }
    workerCondition_.notify_all();
    expiryThread_.join();
}

}  // namespace bookmyshow
