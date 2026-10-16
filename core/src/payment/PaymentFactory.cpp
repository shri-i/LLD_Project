#include "payment/PaymentFactory.hpp"

#include "payment/CardPayment.hpp"
#include "payment/NetBankingPayment.hpp"
#include "payment/UpiPayment.hpp"

#include <stdexcept>

namespace bookmyshow {

std::unique_ptr<PaymentStrategy> PaymentFactory::create(PaymentMode mode) {
    switch (mode) {
        case PaymentMode::CARD:
            return std::make_unique<CardPayment>();
        case PaymentMode::UPI:
            return std::make_unique<UpiPayment>();
        case PaymentMode::NET_BANKING:
            return std::make_unique<NetBankingPayment>();
    }
    throw std::invalid_argument("Unsupported payment mode");
}

}  // namespace bookmyshow
