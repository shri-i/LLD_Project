#pragma once

#include <string>

namespace bookmyshow {

struct Movie {
    std::string id;
    std::string title;
    int durationMins{0};
    std::string language;
    std::string genre;
    std::string posterUrl;
};

}  // namespace bookmyshow
