#pragma once

#include "refund/RefundPolicy.hpp"

namespace bookmyshow {

// Full refund any time before the show starts (e.g. for a promotional event).
class FullRefundPolicy final : public RefundPolicy {
public:
    RefundDecision evaluate(double paidAmount,
                            std::chrono::system_clock::duration timeUntilShow) const override;
};

}  // namespace bookmyshow
