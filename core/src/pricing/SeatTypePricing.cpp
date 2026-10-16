#include "pricing/SeatTypePricing.hpp"

namespace bookmyshow {

double SeatTypePricing::apply(double price, const PricingContext& context) const {
    switch (context.seatType) {
        case SeatType::REGULAR: return price;
        case SeatType::PREMIUM: return price * 1.25;
        case SeatType::VIP: return price * 1.5;
    }
    return price;
}

}  // namespace bookmyshow
