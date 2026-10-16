#include "BookingEngine.hpp"
#include "models/Booking.hpp"
#include "nlohmann/json.hpp"
#include "refund/FullRefundPolicy.hpp"
#include "refund/TieredRefundPolicy.hpp"

#include <gtest/gtest.h>

#include <chrono>
#include <ctime>
#include <memory>
#include <string>
#include <thread>

namespace bookmyshow {
namespace {

using Json = nlohmann::json;
using std::chrono::hours;
using std::chrono::minutes;

TEST(BookingStateMachineTests, OnlyLegalTransitionsAreAllowed) {
    EXPECT_TRUE(Booking::canTransition(BookingStatus::PENDING, BookingStatus::CONFIRMED));
    EXPECT_TRUE(Booking::canTransition(BookingStatus::PENDING, BookingStatus::CANCELLED));
    EXPECT_TRUE(Booking::canTransition(BookingStatus::PENDING, BookingStatus::EXPIRED));
    EXPECT_TRUE(Booking::canTransition(BookingStatus::CONFIRMED, BookingStatus::CANCELLED));

    EXPECT_FALSE(Booking::canTransition(BookingStatus::CONFIRMED, BookingStatus::PENDING));
    EXPECT_FALSE(Booking::canTransition(BookingStatus::CONFIRMED, BookingStatus::EXPIRED));
    EXPECT_FALSE(Booking::canTransition(BookingStatus::CANCELLED, BookingStatus::CONFIRMED));
    EXPECT_FALSE(Booking::canTransition(BookingStatus::EXPIRED, BookingStatus::CONFIRMED));

    Booking booking("b-1", "u-1", "s-1", {"A1"}, 100.0,
                    Booking::Clock::now() + std::chrono::seconds(60));
    EXPECT_TRUE(booking.transitionTo(BookingStatus::CONFIRMED));
    EXPECT_FALSE(booking.transitionTo(BookingStatus::PENDING));
    EXPECT_EQ(booking.status(), BookingStatus::CONFIRMED);
}

TEST(RefundPolicyTests, TieredPolicyDependsOnTimeLeftBeforeShow) {
    const TieredRefundPolicy policy;
    EXPECT_DOUBLE_EQ(policy.evaluate(500.0, hours(30)).amount, 500.0);
    EXPECT_DOUBLE_EQ(policy.evaluate(500.0, hours(5)).amount, 250.0);
    const auto tooLate = policy.evaluate(500.0, minutes(90));
    EXPECT_FALSE(tooLate.allowed);
    EXPECT_FALSE(tooLate.reason.empty());
}

TEST(RefundPolicyTests, FullPolicyRefundsEverythingBeforeTheShow) {
    const FullRefundPolicy policy;
    EXPECT_DOUBLE_EQ(policy.evaluate(500.0, minutes(10)).amount, 500.0);
    EXPECT_FALSE(policy.evaluate(500.0, -minutes(1)).allowed);
}

std::string isoUtc(std::chrono::system_clock::time_point timePoint) {
    const auto raw = std::chrono::system_clock::to_time_t(timePoint);
    std::tm utc{};
#if defined(_WIN32)
    gmtime_s(&utc, &raw);
#else
    gmtime_r(&raw, &utc);
#endif
    char buffer[32];
    std::strftime(buffer, sizeof buffer, "%Y-%m-%dT%H:%M:%SZ", &utc);
    return buffer;
}

std::string showStartingIn(const std::string& showId, std::chrono::hours fromNow) {
    return Json{{"showId", showId},
                {"startTime", isoUtc(std::chrono::system_clock::now() + fromNow)},
                {"basePrice", 200.0},
                {"seats", Json::array({Json{{"seatId", "A1"}, {"row", "A"}, {"number", 1},
                                            {"type", "REGULAR"}}})}}
        .dump();
}

std::string request(const std::string& showId) {
    return Json{{"showId", showId}, {"userId", "user-1"}, {"seatIds", Json::array({"A1"})}}
        .dump();
}

Json bookAndPay(BookingEngine& engine, const std::string& showId) {
    EXPECT_TRUE(Json::parse(engine.loadShow(showStartingIn(showId, hours(5))))
                    .at("ok").get<bool>());
    EXPECT_TRUE(Json::parse(engine.lockSeats(request(showId))).at("ok").get<bool>());
    const auto created = Json::parse(engine.createBooking(request(showId)));
    EXPECT_TRUE(Json::parse(engine.pay(
                    Json{{"bookingId", created.at("bookingId")}, {"mode", "CARD"}}.dump()))
                    .at("ok").get<bool>());
    return created;
}

TEST(BookingLifecycleTests, CancellationRefundFollowsInjectedPolicy) {
    BookingEngine tiered(std::chrono::seconds(60), std::chrono::seconds(1),
                         std::make_shared<TieredRefundPolicy>());
    const auto first = bookAndPay(tiered, "refund-tiered");
    const auto tieredCancel = Json::parse(tiered.cancel(
        Json{{"bookingId", first.at("bookingId")}}.dump()));
    ASSERT_TRUE(tieredCancel.at("ok").get<bool>()) << tieredCancel.dump();
    // Show is 5h away: 50% back under the tiered policy.
    EXPECT_DOUBLE_EQ(tieredCancel.at("refundAmount").get<double>(),
                     first.at("totalAmount").get<double>() / 2);

    BookingEngine full(std::chrono::seconds(60), std::chrono::seconds(1),
                       std::make_shared<FullRefundPolicy>());
    const auto second = bookAndPay(full, "refund-full");
    const auto fullCancel = Json::parse(full.cancel(
        Json{{"bookingId", second.at("bookingId")}}.dump()));
    EXPECT_DOUBLE_EQ(fullCancel.at("refundAmount").get<double>(),
                     second.at("totalAmount").get<double>());
}

TEST(BookingLifecycleTests, PendingBookingExpiresWithItsSeatHold) {
    BookingEngine engine(std::chrono::milliseconds(40), std::chrono::seconds(1));
    ASSERT_TRUE(Json::parse(engine.loadShow(showStartingIn("expiring-booking", hours(48))))
                    .at("ok").get<bool>());
    ASSERT_TRUE(Json::parse(engine.lockSeats(request("expiring-booking"))).at("ok").get<bool>());
    const auto created = Json::parse(engine.createBooking(request("expiring-booking")));
    ASSERT_TRUE(created.at("ok").get<bool>());

    std::this_thread::sleep_for(std::chrono::milliseconds(60));
    const auto paid = Json::parse(engine.pay(
        Json{{"bookingId", created.at("bookingId")}, {"mode", "UPI"}}.dump()));
    EXPECT_FALSE(paid.at("ok").get<bool>());
    EXPECT_NE(paid.at("reason").get<std::string>().find("expired"), std::string::npos);

    // An expired booking is final: it cannot be cancelled or paid later.
    const auto cancelled = Json::parse(engine.cancel(
        Json{{"bookingId", created.at("bookingId")}}.dump()));
    EXPECT_FALSE(cancelled.at("ok").get<bool>());
}

}  // namespace
}  // namespace bookmyshow
