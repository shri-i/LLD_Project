#pragma once

namespace bookmyshow {

class PaymentStrategy {
public:
    virtual ~PaymentStrategy() = default;
    virtual bool pay(double amount) const = 0;
};

}  // namespace bookmyshow
