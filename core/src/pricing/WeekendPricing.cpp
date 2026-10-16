#include "pricing/WeekendPricing.hpp"

namespace bookmyshow {

double WeekendPricing::apply(double price, const PricingContext& context) const {
    const int weekday = context.showTime.tm_wday;  // 0 = Sunday, 6 = Saturday
    return (weekday == 0 || weekday == 6) ? price * 1.20 : price;
}

}  // namespace bookmyshow
