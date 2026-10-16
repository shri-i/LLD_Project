#pragma once

#include "payment/PaymentStrategy.hpp"

namespace bookmyshow {

class UpiPayment final : public PaymentStrategy {
public:
    explicit UpiPayment(bool forceFailure = false);
    bool pay(double amount) const override;

private:
    bool forceFailure_;
};

}  // namespace bookmyshow
