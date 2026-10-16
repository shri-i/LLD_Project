#pragma once

#include "payment/PaymentStrategy.hpp"

namespace bookmyshow {

class NetBankingPayment final : public PaymentStrategy {
public:
    explicit NetBankingPayment(bool forceFailure = false);
    bool pay(double amount) const override;

private:
    bool forceFailure_;
};

}  // namespace bookmyshow
