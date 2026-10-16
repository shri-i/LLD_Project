#include "refund/FullRefundPolicy.hpp"

namespace bookmyshow {

RefundDecision FullRefundPolicy::evaluate(
    double paidAmount, std::chrono::system_clock::duration timeUntilShow) const {
    if (timeUntilShow <= std::chrono::system_clock::duration::zero()) {
        return {false, 0.0, "The show has already started"};
    }
    return {true, paidAmount, {}};
}

}  // namespace bookmyshow
