#include "payment/UpiPayment.hpp"

namespace bookmyshow {

UpiPayment::UpiPayment(bool forceFailure) : forceFailure_(forceFailure) {}

bool UpiPayment::pay(double amount) const {
    return !forceFailure_ && amount > 0.0;
}

}  // namespace bookmyshow
