#pragma once

#include "enums/Enums.hpp"

#include <chrono>
#include <string>

namespace bookmyshow {

struct Payment {
    std::string id;
    std::string bookingId;
    PaymentMode mode{PaymentMode::CARD};
    double amount{0.0};
    PaymentStatus status{PaymentStatus::PENDING};
    std::chrono::system_clock::time_point createdAt{};
};

}  // namespace bookmyshow
