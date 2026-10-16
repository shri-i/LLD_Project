#include "BookingEngine.hpp"

#include "enums/Enums.hpp"
#include "refund/TieredRefundPolicy.hpp"
#include "nlohmann/json.hpp"

#include <algorithm>
#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace bookmyshow {
namespace {

using Json = nlohmann::json;

std::string seatTypeName(SeatType type) {
    switch (type) {
        case SeatType::REGULAR: return "REGULAR";
        case SeatType::PREMIUM: return "PREMIUM";
        case SeatType::VIP: return "VIP";
    }
    return "REGULAR";
}

SeatType parseSeatType(const std::string& value) {
    if (value == "REGULAR") return SeatType::REGULAR;
    if (value == "PREMIUM") return SeatType::PREMIUM;
    if (value == "VIP") return SeatType::VIP;
    throw std::invalid_argument("Unknown seat type: " + value);
}

std::string seatStatusName(SeatStatus status) {
    switch (status) {
        case SeatStatus::AVAILABLE: return "AVAILABLE";
        case SeatStatus::LOCKED: return "LOCKED";
        case SeatStatus::BOOKED: return "BOOKED";
    }
    return "AVAILABLE";
}

SeatStatus parseSeatStatus(const std::string& value) {
    if (value == "AVAILABLE") return SeatStatus::AVAILABLE;
    if (value == "LOCKED") return SeatStatus::LOCKED;
    if (value == "BOOKED") return SeatStatus::BOOKED;
    throw std::invalid_argument("Unknown seat status: " + value);
}

std::string paymentStatusName(PaymentStatus status) {
    switch (status) {
        case PaymentStatus::PENDING: return "PENDING";
        case PaymentStatus::SUCCESS: return "SUCCESS";
        case PaymentStatus::FAILED: return "FAILED";
        case PaymentStatus::REFUNDED: return "REFUNDED";
    }
    return "PENDING";
}

PaymentMode parsePaymentMode(const std::string& value) {
    if (value == "CARD") return PaymentMode::CARD;
    if (value == "UPI") return PaymentMode::UPI;
    if (value == "NET_BANKING") return PaymentMode::NET_BANKING;
    throw std::invalid_argument("Unknown payment mode: " + value);
}

std::chrono::system_clock::time_point parseTime(const Json& value) {
    if (value.is_number_integer()) {
        return std::chrono::system_clock::time_point{
            std::chrono::milliseconds(value.get<std::int64_t>())};
    }
    if (!value.is_string()) {
        throw std::invalid_argument("startTime must be an epoch millisecond number or ISO-8601 string");
    }
    const auto input = value.get<std::string>();
    std::tm parsed{};
    std::istringstream stream(input);
    stream >> std::get_time(&parsed, "%Y-%m-%dT%H:%M:%S");
    if (stream.fail()) {
        throw std::invalid_argument("startTime is not a supported ISO-8601 timestamp");
    }
#if defined(_WIN32)
    const auto seconds = _mkgmtime(&parsed);
#else
    const auto seconds = timegm(&parsed);
#endif
    auto timePoint = std::chrono::system_clock::from_time_t(seconds);
    const auto fractionalStart = input.find('.', 19);
    if (fractionalStart != std::string::npos) {
        std::string fractional = input.substr(fractionalStart + 1, 3);
        while (fractional.size() < 3) fractional.push_back('0');
        timePoint += std::chrono::milliseconds(std::stoi(fractional));
    }
    return timePoint;
}

std::vector<std::string> parseSeatIds(const Json& value) {
    if (!value.is_array()) {
        throw std::invalid_argument("seatIds must be an array");
    }
    return value.get<std::vector<std::string>>();
}

template <typename Duration>
std::int64_t epochMilliseconds(
    std::chrono::time_point<std::chrono::system_clock, Duration> value) {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
               value.time_since_epoch()).count();
}

}  // namespace

BookingEngine::BookingEngine(ShowSeat::Clock::duration lockTtl,
                             std::chrono::milliseconds expiryInterval,
                             std::shared_ptr<const RefundPolicy> refundPolicy,
                             PricingEngine pricingEngine)
    : seatLockManager_(SeatLockManager::getInstance()),
      pricingEngine_(std::move(pricingEngine)),
      bookingService_(seatLockManager_, notificationService_, pricingEngine_,
                      refundPolicy ? std::move(refundPolicy)
                                   : std::make_shared<TieredRefundPolicy>()),
      lockTtl_(lockTtl) {
    if (lockTtl_ <= ShowSeat::Clock::duration::zero()) {
        throw std::invalid_argument("lock TTL must be positive");
    }
    if (expiryInterval <= std::chrono::milliseconds::zero()) {
        throw std::invalid_argument("expiry interval must be positive");
    }
    ownsExpiryThread_ = seatLockManager_.startExpiryThread(expiryInterval);
}

BookingEngine::~BookingEngine() {
    if (ownsExpiryThread_) {
        seatLockManager_.stopExpiryThread();
    }
    std::vector<std::string> showIds;
    {
        std::lock_guard<std::mutex> lock(showsMutex_);
        showIds.reserve(shows_.size());
        for (const auto& showEntry : shows_) {
            showIds.push_back(showEntry.first);
        }
    }
    for (const auto& showId : showIds) {
        seatLockManager_.unregisterShow(showId);
    }
}

std::string BookingEngine::loadShow(const std::string& json) {
    try {
        const auto input = Json::parse(json);
        const auto utcOffsetMinutes = input.value("utcOffsetMinutes", kDefaultUtcOffsetMinutes);
        if (utcOffsetMinutes < -14 * 60 || utcOffsetMinutes > 14 * 60) {
            return errorJson("utcOffsetMinutes must be between -840 and 840");
        }
        const auto screenId = input.value("screenId", std::string{});
        auto show = std::make_shared<Show>(
            input.at("showId").get<std::string>(), input.value("movieId", std::string{}),
            screenId, parseTime(input.at("startTime")), input.at("basePrice").get<double>(),
            utcOffsetMinutes);
        for (const auto& seatJson : input.at("seats")) {
            Seat seat;
            seat.id = seatJson.at("seatId").get<std::string>();
            seat.screenId = screenId;
            seat.rowLabel = seatJson.at("row").get<std::string>();
            seat.seatNumber = seatJson.at("number").get<int>();
            seat.type = parseSeatType(seatJson.at("type").get<std::string>());
            const auto status = parseSeatStatus(
                seatJson.value("status", std::string("AVAILABLE")));
            // Base price before pricing rules; seat type is applied by the rules.
            const auto basePrice = seatJson.value("price", show->basePrice());
            if (!show->addSeat(ShowSeat(std::move(seat), basePrice, status))) {
                return errorJson("Duplicate or empty seat ID");
            }
        }
        if (show->seatCount() == 0) {
            return errorJson("A show must contain at least one seat");
        }
        if (!seatLockManager_.registerShow(show)) {
            return errorJson("Show could not be registered (duplicate show ID)");
        }
        {
            std::lock_guard<std::mutex> lock(showsMutex_);
            shows_.emplace(show->id(), show);
        }
        return Json{{"ok", true}, {"showId", show->id()}}.dump();
    } catch (const std::exception& error) {
        return errorJson(error.what());
    }
}

std::string BookingEngine::getSeatMap(const std::string& json) {
    try {
        const auto input = Json::parse(json);
        const auto show = seatLockManager_.getShow(input.at("showId").get<std::string>());
        if (!show) return Json::array().dump();
        Json seats = Json::array();
        for (const auto& view : show->seatMap()) {
            seats.push_back({{"seatId", view.seat.id},
                             {"row", view.seat.rowLabel},
                             {"number", view.seat.seatNumber},
                             {"type", seatTypeName(view.seat.type)},
                             {"status", seatStatusName(view.status)},
                             {"price", pricingEngine_.priceFor(view.basePrice, view.seat.type,
                                                               show->startTime(),
                                                               show->utcOffsetMinutes())}});
        }
        return seats.dump();
    } catch (const std::exception& error) {
        return errorJson(error.what());
    }
}

std::string BookingEngine::lockSeats(const std::string& json) {
    try {
        const auto input = Json::parse(json);
        const auto showId = input.at("showId").get<std::string>();
        const auto seatIds = parseSeatIds(input.at("seatIds"));
        const auto userId = input.at("userId").get<std::string>();
        const bool ok = seatLockManager_.lockSeats(showId, seatIds, userId, lockTtl_);
        if (!ok) return Json{{"ok", false}, {"reason", "One or more seats are unavailable"}}.dump();
        const auto expiresAt = std::chrono::system_clock::now() + lockTtl_;
        return Json{{"ok", true}, {"expiresAt", epochMilliseconds(expiresAt)}}.dump();
    } catch (const std::exception& error) {
        return Json{{"ok", false}, {"reason", error.what()}}.dump();
    }
}

std::string BookingEngine::unlockSeats(const std::string& json) {
    try {
        const auto input = Json::parse(json);
        const bool ok = seatLockManager_.unlockSeats(
            input.at("showId").get<std::string>(),
            parseSeatIds(input.at("seatIds")),
            input.at("userId").get<std::string>());
        return Json{{"ok", ok}}.dump();
    } catch (const std::exception& error) {
        return Json{{"ok", false}, {"reason", error.what()}}.dump();
    }
}

std::string BookingEngine::createBooking(const std::string& json) {
    try {
        const auto input = Json::parse(json);
        const auto result = bookingService_.createBooking(
            input.at("showId").get<std::string>(), parseSeatIds(input.at("seatIds")),
            input.at("userId").get<std::string>());
        if (!result.ok) return Json{{"ok", false}, {"reason", result.reason}}.dump();
        return Json{{"ok", true}, {"bookingId", result.booking.id()},
                    {"totalAmount", result.booking.totalAmount()}}.dump();
    } catch (const std::exception& error) {
        return Json{{"ok", false}, {"reason", error.what()}}.dump();
    }
}

std::string BookingEngine::pay(const std::string& json) {
    try {
        const auto input = Json::parse(json);
        const auto result = bookingService_.confirmBooking(
            input.at("bookingId").get<std::string>(),
            parsePaymentMode(input.at("mode").get<std::string>()));
        Json output{{"ok", result.ok}, {"status", paymentStatusName(result.payment.status)}};
        if (!result.payment.id.empty()) output["paymentId"] = result.payment.id;
        if (!result.reason.empty()) output["reason"] = result.reason;
        return output.dump();
    } catch (const std::exception& error) {
        return Json{{"ok", false}, {"status", "FAILED"}, {"reason", error.what()}}.dump();
    }
}

std::string BookingEngine::cancel(const std::string& json) {
    try {
        const auto input = Json::parse(json);
        const auto result = bookingService_.cancelBooking(input.at("bookingId").get<std::string>());
        Json output{{"ok", result.ok}, {"refundAmount", result.refundAmount}};
        if (!result.reason.empty()) output["reason"] = result.reason;
        return output.dump();
    } catch (const std::exception& error) {
        return Json{{"ok", false}, {"reason", error.what()}}.dump();
    }
}

// Refund the policy would give for `amount` on this show if cancelled now.
std::string BookingEngine::quoteRefund(const std::string& json) {
    try {
        const auto input = Json::parse(json);
        const auto decision = bookingService_.quoteRefund(input.at("showId").get<std::string>(),
                                                          input.at("amount").get<double>());
        Json output{{"ok", decision.allowed}, {"refundAmount", decision.amount}};
        if (!decision.reason.empty()) output["reason"] = decision.reason;
        return output.dump();
    } catch (const std::exception& error) {
        return Json{{"ok", false}, {"reason", error.what()}}.dump();
    }
}

// Frees BOOKED seats for a booking the engine no longer tracks (for example a
// confirmed booking from before a restart that was cancelled in the database).
std::string BookingEngine::releaseBookedSeats(const std::string& json) {
    try {
        const auto input = Json::parse(json);
        const bool ok = seatLockManager_.cancelConfirmedSeats(
            input.at("showId").get<std::string>(), parseSeatIds(input.at("seatIds")));
        return Json{{"ok", ok}}.dump();
    } catch (const std::exception& error) {
        return Json{{"ok", false}, {"reason", error.what()}}.dump();
    }
}

std::string BookingEngine::releaseExpired(const std::string&) {
    const auto released = seatLockManager_.releaseExpiredLocks();
    return Json{{"released", released},
                {"expiredBookings", bookingService_.expireStaleBookings()}}.dump();
}

NotificationService& BookingEngine::notifications() {
    return notificationService_;
}

std::string BookingEngine::errorJson(const std::string& reason) const {
    return Json{{"ok", false}, {"reason", reason}}.dump();
}

}  // namespace bookmyshow
