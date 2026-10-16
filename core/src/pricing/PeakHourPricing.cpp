#include "pricing/PeakHourPricing.hpp"

namespace bookmyshow {

double PeakHourPricing::apply(double price, const PricingContext& context) const {
    const int hour = context.showTime.tm_hour;
    return (hour >= 17 && hour < 22) ? price * 1.50 : price;
}

}  // namespace bookmyshow
