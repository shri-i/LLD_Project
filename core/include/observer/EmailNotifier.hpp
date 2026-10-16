#pragma once

#include "observer/BookingObserver.hpp"

namespace bookmyshow {

class EmailNotifier final : public BookingObserver {
public:
    void onBookingEvent(const Booking& booking, const std::string& event) const override;
};

}  // namespace bookmyshow
