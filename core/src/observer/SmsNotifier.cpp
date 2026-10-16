#include "observer/SmsNotifier.hpp"

#include <iostream>
#include <mutex>

namespace bookmyshow {
namespace {
std::mutex outputMutex;
}

void SmsNotifier::onBookingEvent(const Booking& booking, const std::string& event) const {
    std::lock_guard<std::mutex> lock(outputMutex);
    std::cout << "[SMS] Booking " << booking.id() << " for user " << booking.userId() << ": "
              << event << '\n';
}

}  // namespace bookmyshow
