#pragma once

#include "enums/Enums.hpp"
#include "payment/PaymentStrategy.hpp"

#include <memory>

namespace bookmyshow {

class PaymentFactory {
public:
    static std::unique_ptr<PaymentStrategy> create(PaymentMode mode);
};

}  // namespace bookmyshow
