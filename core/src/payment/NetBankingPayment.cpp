#include "payment/NetBankingPayment.hpp"

namespace bookmyshow {

NetBankingPayment::NetBankingPayment(bool forceFailure) : forceFailure_(forceFailure) {}

bool NetBankingPayment::pay(double amount) const {
    return !forceFailure_ && amount > 0.0;
}

}  // namespace bookmyshow
