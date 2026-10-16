#pragma once

#include "refund/RefundPolicy.hpp"

namespace bookmyshow {

// 24h or more before the show: 100% refund. 2h to 24h: 50%.
// Under 2h, or after the show started: cancellation is not allowed.
class TieredRefundPolicy final : public RefundPolicy {
public:
    RefundDecision evaluate(double paidAmount,
                            std::chrono::system_clock::duration timeUntilShow) const override;
};

}  // namespace bookmyshow
