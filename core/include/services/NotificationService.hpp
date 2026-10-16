#pragma once

#include "observer/BookingObserver.hpp"

#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace bookmyshow {

class NotificationService {
public:
    void subscribe(const std::shared_ptr<BookingObserver>& observer);
    void notify(const Booking& booking, const std::string& event) const;

private:
    mutable std::mutex mutex_;
    std::vector<std::shared_ptr<BookingObserver>> observers_;
};

}  // namespace bookmyshow
