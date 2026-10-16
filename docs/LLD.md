# BookMyShow – Low-Level Design

Short summary of the booking engine in `core/`. The full guide, with code walkthroughs and interview questions, is [`BookMyShow-LLD-Guide.pdf`](BookMyShow-LLD-Guide.pdf).

## Class diagram

```mermaid
classDiagram
    class BookingEngine {
      <<Facade>>
      +loadShow() +getSeatMap() +lockSeats()
      +createBooking() +pay() +cancel() +quoteRefund()
    }
    class SeatLockManager {
      <<Singleton>>
      -shared_mutex registryMutex
      +getInstance() +lockSeats() +confirmSeats()
      +startExpiryThread()
    }
    class Show {
      <<Aggregate root>>
      -mutex
      -vector~ShowSeat~ seats
      -map seatId→index
      +lockSeats() +confirmSeats() +releaseSeats() +holdExpiry()
    }
    class ShowSeat {
      <<State machine>>
      -status -lockedBy -lockExpiry
      +tryLock() +unlock() +confirm() +release()
    }
    class Booking {
      <<State machine>>
      +canTransition() +transitionTo()
    }
    class BookingService {
      +createBooking() +confirmBooking() +cancelBooking()
    }
    class PricingEngine { +priceFor() +addRule() }
    class PricingStrategy { <<interface>> +apply() }
    class PaymentStrategy { <<interface>> +pay() }
    class PaymentFactory { <<Factory>> +create(mode) }
    class RefundPolicy { <<interface>> +evaluate() }
    class NotificationService { <<Observer subject>> +notify() }
    class BookingObserver { <<interface>> +onBookingEvent() }

    BookingEngine --> BookingService
    BookingEngine --> SeatLockManager
    BookingEngine --> PricingEngine
    SeatLockManager "1" --> "*" Show
    Show "1" *-- "*" ShowSeat
    BookingService --> SeatLockManager
    BookingService --> Booking
    BookingService --> PricingEngine
    BookingService --> RefundPolicy
    BookingService --> PaymentFactory
    BookingService --> NotificationService
    PricingEngine --> "*" PricingStrategy
    PricingStrategy <|.. SeatTypePricing
    PricingStrategy <|.. WeekendPricing
    PricingStrategy <|.. PeakHourPricing
    PaymentFactory ..> PaymentStrategy
    PaymentStrategy <|.. CardPayment
    PaymentStrategy <|.. UpiPayment
    PaymentStrategy <|.. NetBankingPayment
    RefundPolicy <|.. TieredRefundPolicy
    RefundPolicy <|.. FullRefundPolicy
    NotificationService --> "*" BookingObserver
    BookingObserver <|.. EmailNotifier
    BookingObserver <|.. SmsNotifier
```

## State machines

```mermaid
stateDiagram-v2
    direction LR
    state "ShowSeat" as seat {
        AVAILABLE --> LOCKED: tryLock(user, ttl)
        LOCKED --> AVAILABLE: unlock / TTL expiry
        LOCKED --> BOOKED: confirm(user)
        BOOKED --> AVAILABLE: release (cancelled)
    }
```

```mermaid
stateDiagram-v2
    direction LR
    [*] --> PENDING
    PENDING --> CONFIRMED: payment succeeds
    PENDING --> CANCELLED: cancel
    PENDING --> EXPIRED: seat hold runs out
    CONFIRMED --> CANCELLED: cancel (RefundPolicy)
    CANCELLED --> [*]
    EXPIRED --> [*]
```

## Design patterns

| Pattern | Where | Why |
|---|---|---|
| Singleton | `SeatLockManager::getInstance()` | One registry of live shows and one expiry thread per process |
| Strategy | `PricingStrategy`, `PaymentStrategy`, `RefundPolicy` | Swappable pricing rules, payment modes and refund rules |
| Rule chain | `PricingEngine` | New pricing rule = new class, no edits to existing code |
| Factory | `PaymentFactory::create(mode)` | Callers never construct concrete payment classes |
| State machine | `ShowSeat`, `Booking` | Only legal transitions are possible |
| Aggregate root | `Show` | All seat changes under one lock, so multi-seat ops are atomic |
| Observer | `NotificationService` + `EmailNotifier`, `SmsNotifier` | Booking logic does not know who listens |
| Facade | `BookingEngine` | One JSON API for Node.js |
| Dependency injection | `BookingService` constructor | Pricing and refund policy are swappable and testable |

## Concurrency in one paragraph

The show registry uses a `std::shared_mutex` (many concurrent lookups). Each `Show` has one mutex; a multi-seat request checks every seat and only then changes them all, so it is all-or-nothing with nothing to roll back. A request holds at most one show lock, so it cannot deadlock, and different shows never block each other. Holds expire on a `steady_clock` deadline: an expired hold reads as available immediately, and a background thread clears it. Postgres `UNIQUE (show_id, seat_id)` is the final guard. Tests race 50 threads for the same seats; the suite is clean under ThreadSanitizer.

## Booking flow

```mermaid
sequenceDiagram
    participant R as React
    participant E as Express
    participant B as BookingEngine
    participant S as Show
    participant BS as BookingService
    participant P as Payment
    participant DB as Supabase
    R->>E: POST /shows/:id/lock
    E->>B: lockSeats
    B->>S: check all seats, then hold all
    B-->>R: ok + expiresAt
    R->>E: POST /bookings
    E->>BS: createBooking (priced by PricingEngine)
    BS->>S: holdExpiry(seats, user)
    BS-->>R: bookingId + total
    R->>E: POST /bookings/:id/pay
    E->>BS: confirmBooking(mode)
    BS->>P: PaymentFactory.create(mode).pay()
    BS->>S: confirmSeats → BOOKED
    E->>DB: insert booking, seats, payment
    E-->>R: CONFIRMED
```
