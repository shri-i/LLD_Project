#include "services/NotificationService.hpp"

#include <algorithm>

namespace bookmyshow {

void NotificationService::subscribe(const std::shared_ptr<BookingObserver>& observer) {
    if (!observer) {
        return;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    observers_.push_back(observer);
}

void NotificationService::notify(const Booking& booking, const std::string& event) const {
    std::vector<std::shared_ptr<BookingObserver>> observers;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        observers = observers_;
    }
    for (const auto& observer : observers) {
        observer->onBookingEvent(booking, event);
    }
}

}  // namespace bookmyshow
