#include "payment/CardPayment.hpp"
#include "payment/NetBankingPayment.hpp"
#include "payment/PaymentFactory.hpp"
#include "payment/UpiPayment.hpp"
#include "pricing/PeakHourPricing.hpp"
#include "pricing/PricingEngine.hpp"
#include "pricing/SeatTypePricing.hpp"
#include "pricing/WeekendPricing.hpp"

#include <gtest/gtest.h>

#include <ctime>
#include <chrono>
#include <memory>

namespace bookmyshow {
namespace {

TEST(PricingStrategyTests, EachRuleAdjustsOnlyItsOwnConcern) {
    PricingContext tuesdayAfternoon{SeatType::REGULAR, {}};
    tuesdayAfternoon.showTime.tm_wday = 2;
    tuesdayAfternoon.showTime.tm_hour = 14;
    PricingContext saturday = tuesdayAfternoon;
    saturday.showTime.tm_wday = 6;
    PricingContext evening = tuesdayAfternoon;
    evening.showTime.tm_hour = 19;
    PricingContext vip = tuesdayAfternoon;
    vip.seatType = SeatType::VIP;

    EXPECT_DOUBLE_EQ(WeekendPricing{}.apply(200.0, tuesdayAfternoon), 200.0);
    EXPECT_DOUBLE_EQ(WeekendPricing{}.apply(200.0, saturday), 240.0);
    EXPECT_DOUBLE_EQ(PeakHourPricing{}.apply(200.0, evening), 300.0);
    EXPECT_DOUBLE_EQ(SeatTypePricing{}.apply(200.0, vip), 300.0);
}

TEST(PricingEngineTests, DefaultChainUsesTheatreTimeNotServerTime) {
    const auto engine = PricingEngine::withDefaultRules();
    // Saturday 2026-10-17 13:30 UTC is 19:00 in India: weekend and peak hour.
    const auto showTime = std::chrono::system_clock::time_point{
        std::chrono::seconds(1792243800)};
    EXPECT_DOUBLE_EQ(engine.priceFor(200.0, SeatType::REGULAR, showTime, 330), 360.0);
    // The same instant in London (UTC+0) is 13:30: weekend only.
    EXPECT_DOUBLE_EQ(engine.priceFor(200.0, SeatType::REGULAR, showTime, 0), 240.0);
}

// Open/Closed: a new pricing rule is added without changing existing classes.
class FestivalSurcharge final : public PricingStrategy {
public:
    double apply(double price, const PricingContext&) const override { return price + 30.0; }
};

TEST(PricingEngineTests, NewRuleCanBeAddedWithoutChangingExistingCode) {
    auto engine = PricingEngine::withDefaultRules();
    const auto weekdayMorning = std::chrono::system_clock::time_point{
        std::chrono::seconds(1791955800)};  // Wed 2026-10-14 11:00 IST
    EXPECT_DOUBLE_EQ(engine.priceFor(200.0, SeatType::PREMIUM, weekdayMorning, 330), 250.0);
    engine.addRule(std::make_shared<FestivalSurcharge>());
    EXPECT_DOUBLE_EQ(engine.priceFor(200.0, SeatType::PREMIUM, weekdayMorning, 330), 280.0);
}

TEST(PaymentFactoryTests, CreatesStrategyForEachPaymentMode) {
    EXPECT_NE(dynamic_cast<CardPayment*>(PaymentFactory::create(PaymentMode::CARD).get()), nullptr);
    EXPECT_NE(dynamic_cast<UpiPayment*>(PaymentFactory::create(PaymentMode::UPI).get()), nullptr);
    EXPECT_NE(dynamic_cast<NetBankingPayment*>(
                  PaymentFactory::create(PaymentMode::NET_BANKING).get()),
              nullptr);
}

TEST(PaymentStrategyTests, ForcedFailureReturnsFalse) {
    const CardPayment card(true);
    const UpiPayment upi(true);
    const NetBankingPayment netBanking(true);

    EXPECT_FALSE(card.pay(100.0));
    EXPECT_FALSE(upi.pay(100.0));
    EXPECT_FALSE(netBanking.pay(100.0));
}

}  // namespace
}  // namespace bookmyshow
