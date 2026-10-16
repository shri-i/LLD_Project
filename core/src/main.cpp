#include "BookingEngine.hpp"
#include "observer/EmailNotifier.hpp"
#include "observer/SmsNotifier.hpp"
#include "nlohmann/json.hpp"

#include <iostream>
#include <memory>
#include <string>

int main() {
    using bookmyshow::BookingEngine;
    using Json = nlohmann::json;

    BookingEngine engine;
    engine.notifications().subscribe(std::make_shared<bookmyshow::EmailNotifier>());
    engine.notifications().subscribe(std::make_shared<bookmyshow::SmsNotifier>());

    const auto loaded = Json::parse(engine.loadShow(R"({
        "showId": "demo-show",
        "movieId": "demo-movie",
        "screenId": "screen-1",
        "startTime": "2026-10-17T19:00:00Z",
        "basePrice": 250,
        "seats": [
            {"seatId":"A1","row":"A","number":1,"type":"REGULAR","status":"AVAILABLE"},
            {"seatId":"A2","row":"A","number":2,"type":"PREMIUM","status":"AVAILABLE"}
        ]
    })"));
    std::cout << "loadShow: " << loaded.dump() << '\n';
    if (!loaded.value("ok", false)) return 1;

    const std::string seatIds = R"(["A1","A2"])";
    const auto lock = Json::parse(engine.lockSeats(
        Json{{"showId", "demo-show"}, {"seatIds", Json::parse(seatIds)}, {"userId", "user-1"}}.dump()));
    std::cout << "lockSeats: " << lock.dump() << '\n';
    if (!lock.value("ok", false)) return 1;

    const auto competingLock = Json::parse(engine.lockSeats(
        Json{{"showId", "demo-show"}, {"seatIds", Json::parse(seatIds)}, {"userId", "user-2"}}.dump()));
    std::cout << "second user's lock attempt: " << competingLock.dump() << '\n';

    const auto created = Json::parse(engine.createBooking(
        Json{{"showId", "demo-show"}, {"seatIds", Json::parse(seatIds)}, {"userId", "user-1"}}.dump()));
    std::cout << "createBooking: " << created.dump() << '\n';
    if (!created.value("ok", false)) return 1;

    const auto paid = Json::parse(engine.pay(
        Json{{"bookingId", created.at("bookingId")}, {"mode", "CARD"}}.dump()));
    std::cout << "pay: " << paid.dump() << '\n';
    return paid.value("ok", false) ? 0 : 1;
}
