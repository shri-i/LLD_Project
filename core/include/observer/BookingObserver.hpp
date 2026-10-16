#pragma once

#include "models/Booking.hpp"

#include <string>

namespace bookmyshow {

class BookingObserver {
public:
    virtual ~BookingObserver() = default;
    virtual void onBookingEvent(const Booking& booking, const std::string& event) const = 0;
};

}  // namespace bookmyshow
