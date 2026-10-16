#pragma once

#include "pricing/PricingStrategy.hpp"

namespace bookmyshow {

// Multiplies by seat type: REGULAR x1.0, PREMIUM x1.25, VIP x1.5.
class SeatTypePricing final : public PricingStrategy {
public:
    double apply(double price, const PricingContext& context) const override;
};

}  // namespace bookmyshow
