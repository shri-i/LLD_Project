#pragma once

#include "enums/Enums.hpp"

#include <string>

namespace bookmyshow {

struct Seat {
    std::string id;
    std::string screenId;
    std::string rowLabel;
    int seatNumber{0};
    SeatType type{SeatType::REGULAR};
};

}  // namespace bookmyshow
