#pragma once

#include "pricing/PricingStrategy.hpp"

namespace bookmyshow {

// Adds 50% for shows starting between 17:00 and 21:59.
class PeakHourPricing final : public PricingStrategy {
public:
    double apply(double price, const PricingContext& context) const override;
};

}  // namespace bookmyshow
