#pragma once

#include "enums/Enums.hpp"
#include "pricing/PricingStrategy.hpp"

#include <chrono>
#include <memory>
#include <vector>

namespace bookmyshow {

// Default theatre timezone: IST (UTC+05:30).
constexpr int kDefaultUtcOffsetMinutes = 330;

// Applies an ordered chain of PricingStrategy rules to a seat's base price.
// New rules (festival surcharge, matinee discount, ...) are added by writing a
// new PricingStrategy and passing it in; existing code does not change
// (Open/Closed Principle). Configure the rules before sharing the engine
// between threads; priceFor() itself is read-only.
class PricingEngine {
public:
    using Rules = std::vector<std::shared_ptr<const PricingStrategy>>;

    explicit PricingEngine(Rules rules = {});
    static PricingEngine withDefaultRules();  // seat type -> weekend -> peak hour

    void addRule(std::shared_ptr<const PricingStrategy> rule);
    std::size_t ruleCount() const { return rules_.size(); }

    // Final price for one seat, rounded to 2 decimals. Day and hour are read in
    // the theatre's local time (utcOffsetMinutes), never the server's timezone.
    double priceFor(double seatBasePrice, SeatType seatType,
                    std::chrono::system_clock::time_point showTime,
                    int utcOffsetMinutes) const;

    static std::tm theatreLocalTime(std::chrono::system_clock::time_point timePoint,
                                    int utcOffsetMinutes);

private:
    Rules rules_;
};

}  // namespace bookmyshow
