#include "BookingEngine.hpp"
#include "nlohmann/json.hpp"

#include <gtest/gtest.h>

#include <chrono>
#include <string>
#include <thread>

namespace bookmyshow {
namespace {

using Json = nlohmann::json;

std::string sampleShowJson(const std::string& showId) {
    return Json{{"showId", showId},
                {"movieId", "movie-1"},
                {"screenId", "screen-1"},
                {"startTime", "2026-10-19T12:00:00Z"},
                {"basePrice", 200.0},
                {"seats", Json::array({
                    Json{{"seatId", "A1"}, {"row", "A"}, {"number", 1},
                         {"type", "REGULAR"}, {"status", "AVAILABLE"}},
                    Json{{"seatId", "A2"}, {"row", "A"}, {"number", 2},
                         {"type", "PREMIUM"}, {"status", "AVAILABLE"}}
                })}}.dump();
}

std::string request(const std::string& showId,
                    const std::string& userId,
                    const Json& seatIds = Json::array({"A1", "A2"})) {
    return Json{{"showId", showId}, {"userId", userId}, {"seatIds", seatIds}}.dump();
}

Json seatMap(BookingEngine& engine, const std::string& showId) {
    return Json::parse(engine.getSeatMap(Json{{"showId", showId}}.dump()));
}

TEST(BookingEngineTests, FullBookingFlowAndConfirmedCancellation) {
    BookingEngine engine(std::chrono::seconds(2), std::chrono::milliseconds(2));
    const auto loaded = Json::parse(engine.loadShow(sampleShowJson("engine-flow-show")));
    ASSERT_TRUE(loaded.at("ok").get<bool>()) << loaded.dump();

    const auto lock = Json::parse(engine.lockSeats(request("engine-flow-show", "user-1")));
    ASSERT_TRUE(lock.at("ok").get<bool>()) << lock.dump();
    const auto competingLock = Json::parse(engine.lockSeats(request("engine-flow-show", "user-2")));
    EXPECT_FALSE(competingLock.at("ok").get<bool>());

    const auto created = Json::parse(engine.createBooking(request("engine-flow-show", "user-1")));
    ASSERT_TRUE(created.at("ok").get<bool>()) << created.dump();
    EXPECT_GT(created.at("totalAmount").get<double>(), 0.0);

    const auto paid = Json::parse(engine.pay(
        Json{{"bookingId", created.at("bookingId")}, {"mode", "UPI"}}.dump()));
    ASSERT_TRUE(paid.at("ok").get<bool>()) << paid.dump();
    EXPECT_EQ(paid.at("status"), "SUCCESS");
    ASSERT_EQ(seatMap(engine, "engine-flow-show").at(0).at("status"), "BOOKED");

    const auto cancelled = Json::parse(engine.cancel(
        Json{{"bookingId", created.at("bookingId")}}.dump()));
    ASSERT_TRUE(cancelled.at("ok").get<bool>()) << cancelled.dump();
    EXPECT_EQ(seatMap(engine, "engine-flow-show").at(0).at("status"), "AVAILABLE");
    EXPECT_EQ(seatMap(engine, "engine-flow-show").at(1).at("status"), "AVAILABLE");
}

TEST(BookingEngineTests, PendingCancellationReleasesLockedSeats) {
    BookingEngine engine(std::chrono::seconds(2), std::chrono::milliseconds(2));
    ASSERT_TRUE(Json::parse(engine.loadShow(sampleShowJson("engine-pending-cancel")))
                    .at("ok").get<bool>());
    ASSERT_TRUE(Json::parse(engine.lockSeats(request("engine-pending-cancel", "user-1")))
                    .at("ok").get<bool>());
    const auto created = Json::parse(engine.createBooking(request("engine-pending-cancel", "user-1")));
    ASSERT_TRUE(created.at("ok").get<bool>()) << created.dump();

    const auto cancelled = Json::parse(engine.cancel(
        Json{{"bookingId", created.at("bookingId")}}.dump()));
    ASSERT_TRUE(cancelled.at("ok").get<bool>()) << cancelled.dump();
    EXPECT_EQ(seatMap(engine, "engine-pending-cancel").at(0).at("status"), "AVAILABLE");
}

TEST(BookingEngineTests, ExpiredLockIsReleasedAndCannotCreateBooking) {
    BookingEngine engine(std::chrono::milliseconds(40), std::chrono::milliseconds(2));
    ASSERT_TRUE(Json::parse(engine.loadShow(sampleShowJson("engine-expiry")))
                    .at("ok").get<bool>());
    ASSERT_TRUE(Json::parse(engine.lockSeats(request("engine-expiry", "user-1")))
                    .at("ok").get<bool>());

    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(2);
    while (seatMap(engine, "engine-expiry").at(0).at("status") != "AVAILABLE" &&
           std::chrono::steady_clock::now() < deadline) {
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
    EXPECT_EQ(seatMap(engine, "engine-expiry").at(0).at("status"), "AVAILABLE");
    const auto created = Json::parse(engine.createBooking(request("engine-expiry", "user-1")));
    EXPECT_FALSE(created.at("ok").get<bool>());
}

TEST(BookingEngineTests, SeatMapPriceMatchesChargedTotal) {
    BookingEngine engine(std::chrono::seconds(2), std::chrono::milliseconds(2));
    // Saturday 2026-10-17 13:30 UTC = 19:00 IST: weekend (x1.2) and peak (x1.5).
    const auto show = Json{{"showId", "engine-pricing"}, {"startTime", "2026-10-17T13:30:00Z"},
                           {"basePrice", 200.0}, {"utcOffsetMinutes", 330},
                           {"seats", Json::array({
                               Json{{"seatId", "A1"}, {"row", "A"}, {"number", 1}, {"type", "REGULAR"}},
                               Json{{"seatId", "A2"}, {"row", "A"}, {"number", 2}, {"type", "PREMIUM"}},
                               Json{{"seatId", "A3"}, {"row", "A"}, {"number", 3}, {"type", "VIP"}}
                           })}};
    ASSERT_TRUE(Json::parse(engine.loadShow(show.dump())).at("ok").get<bool>());

    const auto seats = seatMap(engine, "engine-pricing");
    EXPECT_DOUBLE_EQ(seats.at(0).at("price").get<double>(), 360.0);  // 200 * 1.2 * 1.5
    EXPECT_DOUBLE_EQ(seats.at(1).at("price").get<double>(), 450.0);  // PREMIUM x1.25
    EXPECT_DOUBLE_EQ(seats.at(2).at("price").get<double>(), 540.0);  // VIP x1.5

    const auto ids = Json::array({"A1", "A2", "A3"});
    ASSERT_TRUE(Json::parse(engine.lockSeats(request("engine-pricing", "user-1", ids)))
                    .at("ok").get<bool>());
    const auto created = Json::parse(engine.createBooking(request("engine-pricing", "user-1", ids)));
    ASSERT_TRUE(created.at("ok").get<bool>()) << created.dump();
    EXPECT_DOUBLE_EQ(created.at("totalAmount").get<double>(), 1350.0);
}

TEST(BookingEngineTests, ReleaseBookedSeatsFreesUntrackedBooking) {
    BookingEngine engine(std::chrono::seconds(2), std::chrono::milliseconds(2));
    auto show = Json::parse(sampleShowJson("engine-release-booked"));
    show["seats"][0]["status"] = "BOOKED";
    ASSERT_TRUE(Json::parse(engine.loadShow(show.dump())).at("ok").get<bool>());

    const auto released = Json::parse(engine.releaseBookedSeats(
        Json{{"showId", "engine-release-booked"}, {"seatIds", Json::array({"A1"})}}.dump()));
    EXPECT_TRUE(released.at("ok").get<bool>()) << released.dump();
    EXPECT_EQ(seatMap(engine, "engine-release-booked").at(0).at("status"), "AVAILABLE");
}

}  // namespace
}  // namespace bookmyshow
