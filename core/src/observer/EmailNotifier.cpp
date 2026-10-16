#include "observer/EmailNotifier.hpp"

#include <iostream>
#include <mutex>

namespace bookmyshow {
namespace {
std::mutex outputMutex;
}

void EmailNotifier::onBookingEvent(const Booking& booking, const std::string& event) const {
    std::lock_guard<std::mutex> lock(outputMutex);
    std::cout << "[Email] Booking " << booking.id() << " for user " << booking.userId() << ": "
              << event << '\n';
}

}  // namespace bookmyshow
