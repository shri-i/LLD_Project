#pragma once

#include "enums/Enums.hpp"

#include <ctime>

namespace bookmyshow {

// What a pricing rule may look at when adjusting a seat's price.
struct PricingContext {
    SeatType seatType{SeatType::REGULAR};
    std::tm showTime{};  // show start in the theatre's local time
};

// Strategy: one independent pricing rule. Rules are chained by PricingEngine,
// each receiving the price produced by the previous rule.
class PricingStrategy {
public:
    virtual ~PricingStrategy() = default;
    virtual double apply(double price, const PricingContext& context) const = 0;
};

}  // namespace bookmyshow
