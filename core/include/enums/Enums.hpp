#pragma once

namespace bookmyshow {

enum class SeatType { REGULAR, PREMIUM, VIP };
enum class SeatStatus { AVAILABLE, LOCKED, BOOKED };
enum class BookingStatus { PENDING, CONFIRMED, CANCELLED, EXPIRED };
enum class PaymentMode { CARD, UPI, NET_BANKING };
enum class PaymentStatus { PENDING, SUCCESS, FAILED, REFUNDED };

}  // namespace bookmyshow
