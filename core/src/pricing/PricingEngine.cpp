#include "pricing/PricingEngine.hpp"

#include "pricing/PeakHourPricing.hpp"
#include "pricing/SeatTypePricing.hpp"
#include "pricing/WeekendPricing.hpp"

#include <cmath>
#include <ctime>
#include <utility>

namespace bookmyshow {

PricingEngine::PricingEngine(Rules rules) : rules_(std::move(rules)) {}

PricingEngine PricingEngine::withDefaultRules() {
    return PricingEngine({std::make_shared<SeatTypePricing>(),
                          std::make_shared<WeekendPricing>(),
                          std::make_shared<PeakHourPricing>()});
}

void PricingEngine::addRule(std::shared_ptr<const PricingStrategy> rule) {
    if (rule) {
        rules_.push_back(std::move(rule));
    }
}

double PricingEngine::priceFor(double seatBasePrice, SeatType seatType,
                               std::chrono::system_clock::time_point showTime,
                               int utcOffsetMinutes) const {
    const PricingContext context{seatType, theatreLocalTime(showTime, utcOffsetMinutes)};
    double price = seatBasePrice;
    for (const auto& rule : rules_) {
        price = rule->apply(price, context);
    }
    return std::round(price * 100.0) / 100.0;
}

std::tm PricingEngine::theatreLocalTime(std::chrono::system_clock::time_point timePoint,
                                        int utcOffsetMinutes) {
    const auto shifted = timePoint + std::chrono::minutes(utcOffsetMinutes);
    const auto rawTime = std::chrono::system_clock::to_time_t(shifted);
    std::tm result{};
#if defined(_WIN32)
    gmtime_s(&result, &rawTime);
#else
    gmtime_r(&rawTime, &result);
#endif
    return result;
}

}  // namespace bookmyshow
