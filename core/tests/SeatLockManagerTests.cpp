#include "services/SeatLockManager.hpp"

#include <gtest/gtest.h>

#include <atomic>
#include <chrono>
#include <memory>
#include <string>
#include <thread>
#include <vector>

namespace bookmyshow {
namespace {

std::shared_ptr<Show> makeShow(const std::string& showId,
                               const std::vector<std::string>& seatIds) {
    auto show = std::make_shared<Show>(showId, "movie-1", "screen-1",
                                       std::chrono::system_clock::now(), 100.0);
    int seatNumber = 1;
    for (const auto& seatId : seatIds) {
        show->addSeat(ShowSeat(Seat{seatId, "screen-1", "A", seatNumber++, SeatType::REGULAR},
                               100.0));
    }
    return show;
}

SeatStatus statusOf(const Show& show, const std::string& seatId) {
    return show.findSeat(seatId)->status;
}

class RegisteredShow {
public:
    explicit RegisteredShow(const std::vector<std::string>& seatIds) {
        static std::atomic<unsigned long> nextId{0};
        show_ = makeShow("lock-test-show-" + std::to_string(++nextId), seatIds);
        registered_ = SeatLockManager::getInstance().registerShow(show_);
        EXPECT_TRUE(registered_);
    }

    ~RegisteredShow() {
        if (registered_) {
            SeatLockManager::getInstance().unregisterShow(show_->id());
        }
    }

    const std::shared_ptr<Show>& get() const { return show_; }

private:
    std::shared_ptr<Show> show_;
    bool registered_{false};
};

TEST(SeatLockManagerTests, OnlyOneThreadCanLockTheSameSeat) {
    auto& manager = SeatLockManager::getInstance();
    RegisteredShow registeredShow({"seat-a"});
    const auto show = registeredShow.get();
    std::atomic<int> ready{0};
    std::atomic<bool> start{false};
    bool outcomes[2] = {false, false};

    std::thread first([&]() {
        ++ready;
        while (!start.load()) {
            std::this_thread::yield();
        }
        outcomes[0] = manager.lockSeats(show->id(), {"seat-a"}, "user-1",
                                        std::chrono::seconds(5));
    });
    std::thread second([&]() {
        ++ready;
        while (!start.load()) {
            std::this_thread::yield();
        }
        outcomes[1] = manager.lockSeats(show->id(), {"seat-a"}, "user-2",
                                        std::chrono::seconds(5));
    });

    while (ready.load() != 2) {
        std::this_thread::yield();
    }
    start = true;
    first.join();
    second.join();

    EXPECT_NE(outcomes[0], outcomes[1]);
    manager.unlockSeats(show->id(), {"seat-a"}, outcomes[0] ? "user-1" : "user-2");
}

TEST(SeatLockManagerTests, FiftyThreadsRaceForFiveSeatsAndOnlyOneWins) {
    auto& manager = SeatLockManager::getInstance();
    const std::vector<std::string> seatIds{"seat-a", "seat-b", "seat-c", "seat-d", "seat-e"};
    RegisteredShow registeredShow(seatIds);
    const auto show = registeredShow.get();
    constexpr int threadCount = 50;
    std::atomic<int> ready{0};
    std::atomic<bool> start{false};
    std::vector<int> outcomes(threadCount, 0);
    std::vector<std::thread> threads;
    threads.reserve(threadCount);

    for (int i = 0; i < threadCount; ++i) {
        threads.emplace_back([&, i]() {
            ++ready;
            while (!start.load()) {
                std::this_thread::yield();
            }
            outcomes[i] = manager.lockSeats(show->id(), seatIds, "racer-" + std::to_string(i),
                                            std::chrono::seconds(5))
                               ? 1
                               : 0;
        });
    }
    while (ready.load() != threadCount) {
        std::this_thread::yield();
    }
    start = true;
    for (auto& thread : threads) {
        thread.join();
    }

    int winners = 0;
    int winnerIndex = -1;
    for (int i = 0; i < threadCount; ++i) {
        if (outcomes[i] != 0) {
            ++winners;
            winnerIndex = i;
        }
    }
    EXPECT_EQ(winners, 1);
    if (winnerIndex >= 0) {
        manager.unlockSeats(show->id(), seatIds, "racer-" + std::to_string(winnerIndex));
    }
}

TEST(SeatLockManagerTests, OpposingSeatOrdersCompleteWithoutDeadlock) {
    auto& manager = SeatLockManager::getInstance();
    RegisteredShow registeredShow({"seat-a", "seat-b"});
    const auto show = registeredShow.get();
    std::atomic<int> ready{0};
    std::atomic<bool> start{false};
    bool outcomes[2] = {false, false};

    std::thread first([&]() {
        ++ready;
        while (!start.load()) {
            std::this_thread::yield();
        }
        outcomes[0] = manager.lockSeats(show->id(), {"seat-a", "seat-b"}, "user-1",
                                        std::chrono::seconds(5));
    });
    std::thread second([&]() {
        ++ready;
        while (!start.load()) {
            std::this_thread::yield();
        }
        outcomes[1] = manager.lockSeats(show->id(), {"seat-b", "seat-a"}, "user-2",
                                        std::chrono::seconds(5));
    });

    while (ready.load() != 2) {
        std::this_thread::yield();
    }
    start = true;
    first.join();
    second.join();

    EXPECT_NE(outcomes[0], outcomes[1]);
    manager.unlockSeats(show->id(), {"seat-a", "seat-b"}, outcomes[0] ? "user-1" : "user-2");
}

TEST(SeatLockManagerTests, BackgroundWorkerReleasesExpiredLock) {
    auto& manager = SeatLockManager::getInstance();
    RegisteredShow registeredShow({"seat-a"});
    const auto show = registeredShow.get();

    ASSERT_TRUE(manager.lockSeats(show->id(), {"seat-a"}, "user-1", std::chrono::milliseconds(30)));
    ASSERT_EQ(statusOf(*show, "seat-a"), SeatStatus::LOCKED);
    ASSERT_TRUE(manager.startExpiryThread(std::chrono::milliseconds(2)));

    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(2);
    while (show->heldSeatCount() != 0 &&
           std::chrono::steady_clock::now() < deadline) {
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
    manager.stopExpiryThread();

    EXPECT_EQ(show->heldSeatCount(), 0u);
    EXPECT_EQ(statusOf(*show, "seat-a"), SeatStatus::AVAILABLE);
}

TEST(SeatLockManagerTests, FailedMultiSeatLockChangesNothing) {
    auto& manager = SeatLockManager::getInstance();
    RegisteredShow registeredShow({"seat-a-free", "seat-b-held"});
    const auto show = registeredShow.get();

    ASSERT_TRUE(manager.lockSeats(show->id(), {"seat-b-held"}, "owner",
                                  std::chrono::seconds(5)));
    EXPECT_FALSE(manager.lockSeats(show->id(), {"seat-b-held", "seat-a-free"}, "contender",
                                   std::chrono::seconds(5)));
    EXPECT_EQ(statusOf(*show, "seat-a-free"), SeatStatus::AVAILABLE);
    EXPECT_EQ(statusOf(*show, "seat-b-held"), SeatStatus::LOCKED);

    EXPECT_TRUE(manager.unlockSeats(show->id(), {"seat-b-held"}, "owner"));
    EXPECT_EQ(statusOf(*show, "seat-a-free"), SeatStatus::AVAILABLE);
    EXPECT_EQ(statusOf(*show, "seat-b-held"), SeatStatus::AVAILABLE);
}

}  // namespace
}  // namespace bookmyshow
