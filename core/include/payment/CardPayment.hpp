#pragma once

#include "payment/PaymentStrategy.hpp"

namespace bookmyshow {

class CardPayment final : public PaymentStrategy {
public:
    explicit CardPayment(bool forceFailure = false);
    bool pay(double amount) const override;

private:
    bool forceFailure_;
};

}  // namespace bookmyshow
