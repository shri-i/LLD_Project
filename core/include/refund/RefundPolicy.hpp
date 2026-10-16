#pragma once

#include <chrono>
#include <string>

namespace bookmyshow {

struct RefundDecision {
    bool allowed{false};
    double amount{0.0};
    std::string reason;  // why cancellation is not allowed
};

// Strategy: decides whether a confirmed booking may be cancelled and how much
// of the paid amount is returned, based on how long remains until the show.
class RefundPolicy {
public:
    virtual ~RefundPolicy() = default;
    virtual RefundDecision evaluate(double paidAmount,
                                    std::chrono::system_clock::duration timeUntilShow) const = 0;
};

}  // namespace bookmyshow
