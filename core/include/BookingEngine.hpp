#pragma once

#include "models/Show.hpp"
#include "pricing/PricingEngine.hpp"
#include "refund/RefundPolicy.hpp"
#include "services/BookingService.hpp"
#include "services/NotificationService.hpp"
#include "services/SeatLockManager.hpp"

#include <chrono>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

namespace bookmyshow {

// Facade: the single JSON-in / JSON-out entry point used by the Node.js addon.
// It hides the models, SeatLockManager, BookingService, pricing and payments.
class BookingEngine {
public:
    explicit BookingEngine(ShowSeat::Clock::duration lockTtl = std::chrono::seconds(300),
                           std::chrono::milliseconds expiryInterval = std::chrono::seconds(1),
                           std::shared_ptr<const RefundPolicy> refundPolicy = nullptr,
                           PricingEngine pricingEngine = PricingEngine::withDefaultRules());
    ~BookingEngine();

    BookingEngine(const BookingEngine&) = delete;
    BookingEngine& operator=(const BookingEngine&) = delete;

    std::string loadShow(const std::string& json);
    std::string getSeatMap(const std::string& json);
    std::string lockSeats(const std::string& json);
    std::string unlockSeats(const std::string& json);
    std::string createBooking(const std::string& json);
    std::string pay(const std::string& json);
    std::string cancel(const std::string& json);
    std::string releaseBookedSeats(const std::string& json);
    std::string quoteRefund(const std::string& json);
    std::string releaseExpired(const std::string& json = "{}");

    NotificationService& notifications();

private:
    std::string errorJson(const std::string& reason) const;

    SeatLockManager& seatLockManager_;
    NotificationService notificationService_;
    PricingEngine pricingEngine_;  // declared before bookingService_, which refers to it
    BookingService bookingService_;
    ShowSeat::Clock::duration lockTtl_;
    bool ownsExpiryThread_{false};
    mutable std::mutex showsMutex_;
    std::unordered_map<std::string, std::shared_ptr<Show>> shows_;
};

}  // namespace bookmyshow
