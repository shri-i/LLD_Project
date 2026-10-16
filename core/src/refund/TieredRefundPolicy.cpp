#include "refund/TieredRefundPolicy.hpp"

#include <cmath>

namespace bookmyshow {

RefundDecision TieredRefundPolicy::evaluate(
    double paidAmount, std::chrono::system_clock::duration timeUntilShow) const {
    using std::chrono::hours;
    if (timeUntilShow >= hours(24)) {
        return {true, paidAmount, {}};
    }
    if (timeUntilShow >= hours(2)) {
        return {true, std::round(paidAmount * 50.0) / 100.0, {}};
    }
    return {false, 0.0, "Cancellation closes 2 hours before the show"};
}

}  // namespace bookmyshow
