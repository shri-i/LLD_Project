#include "payment/CardPayment.hpp"

namespace bookmyshow {

CardPayment::CardPayment(bool forceFailure) : forceFailure_(forceFailure) {}

bool CardPayment::pay(double amount) const {
    return !forceFailure_ && amount > 0.0;
}

}  // namespace bookmyshow
