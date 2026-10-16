#pragma once

#include "pricing/PricingStrategy.hpp"

namespace bookmyshow {

// Adds 20% for shows on Saturday or Sunday.
class WeekendPricing final : public PricingStrategy {
public:
    double apply(double price, const PricingContext& context) const override;
};

}  // namespace bookmyshow
