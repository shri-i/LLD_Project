#include "BookingEngine.hpp"

#include <napi.h>

#include <chrono>
#include <exception>
#include <string>

namespace {

class BookingEngineBinding final : public Napi::ObjectWrap<BookingEngineBinding> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        const auto type = DefineClass(env, "BookingEngine", {
            InstanceMethod("loadShow", &BookingEngineBinding::loadShow),
            InstanceMethod("getSeatMap", &BookingEngineBinding::getSeatMap),
            InstanceMethod("lockSeats", &BookingEngineBinding::lockSeats),
            InstanceMethod("unlockSeats", &BookingEngineBinding::unlockSeats),
            InstanceMethod("createBooking", &BookingEngineBinding::createBooking),
            InstanceMethod("pay", &BookingEngineBinding::pay),
            InstanceMethod("cancel", &BookingEngineBinding::cancel),
            InstanceMethod("releaseBookedSeats", &BookingEngineBinding::releaseBookedSeats),
            InstanceMethod("quoteRefund", &BookingEngineBinding::quoteRefund),
            InstanceMethod("releaseExpired", &BookingEngineBinding::releaseExpired),
        });
        exports.Set("BookingEngine", type);
        return exports;
    }

    // new BookingEngine({ lockTtlSeconds }) — the TTL is optional (default 300s).
    explicit BookingEngineBinding(const Napi::CallbackInfo& info)
        : Napi::ObjectWrap<BookingEngineBinding>(info), engine_(lockTtlFrom(info)) {}

private:
    static std::chrono::seconds lockTtlFrom(const Napi::CallbackInfo& info) {
        if (info.Length() > 0 && info[0].IsObject()) {
            const auto ttl = info[0].As<Napi::Object>().Get("lockTtlSeconds");
            if (ttl.IsNumber() && ttl.As<Napi::Number>().Int64Value() > 0) {
                return std::chrono::seconds(ttl.As<Napi::Number>().Int64Value());
            }
        }
        return std::chrono::seconds(300);
    }

    Napi::Value loadShow(const Napi::CallbackInfo& info) {
        return invoke(info, "loadShow", [this](const std::string& input) {
            return engine_.loadShow(input);
        });
    }

    Napi::Value getSeatMap(const Napi::CallbackInfo& info) {
        return invoke(info, "getSeatMap", [this](const std::string& input) {
            return engine_.getSeatMap(input);
        });
    }

    Napi::Value lockSeats(const Napi::CallbackInfo& info) {
        return invoke(info, "lockSeats", [this](const std::string& input) {
            return engine_.lockSeats(input);
        });
    }

    Napi::Value unlockSeats(const Napi::CallbackInfo& info) {
        return invoke(info, "unlockSeats", [this](const std::string& input) {
            return engine_.unlockSeats(input);
        });
    }

    Napi::Value createBooking(const Napi::CallbackInfo& info) {
        return invoke(info, "createBooking", [this](const std::string& input) {
            return engine_.createBooking(input);
        });
    }

    Napi::Value pay(const Napi::CallbackInfo& info) {
        return invoke(info, "pay", [this](const std::string& input) {
            return engine_.pay(input);
        });
    }

    Napi::Value cancel(const Napi::CallbackInfo& info) {
        return invoke(info, "cancel", [this](const std::string& input) {
            return engine_.cancel(input);
        });
    }

    Napi::Value releaseBookedSeats(const Napi::CallbackInfo& info) {
        return invoke(info, "releaseBookedSeats", [this](const std::string& input) {
            return engine_.releaseBookedSeats(input);
        });
    }

    Napi::Value quoteRefund(const Napi::CallbackInfo& info) {
        return invoke(info, "quoteRefund", [this](const std::string& input) {
            return engine_.quoteRefund(input);
        });
    }

    Napi::Value releaseExpired(const Napi::CallbackInfo& info) {
        return invoke(info, "releaseExpired", [this](const std::string& input) {
            return engine_.releaseExpired(input);
        });
    }

    template <typename Callback>
    Napi::Value invoke(const Napi::CallbackInfo& info,
                       const char* methodName,
                       Callback callback) {
        const auto env = info.Env();
        if (info.Length() != 1 || !info[0].IsString()) {
            Napi::TypeError::New(env, std::string(methodName) +
                                         " expects one JSON string argument")
                .ThrowAsJavaScriptException();
            return env.Null();
        }
        try {
            return Napi::String::New(env, callback(info[0].As<Napi::String>().Utf8Value()));
        } catch (const std::exception& error) {
            Napi::Error::New(env, error.what()).ThrowAsJavaScriptException();
            return env.Null();
        }
    }

    bookmyshow::BookingEngine engine_;
};

}  // namespace

NODE_API_NAMED_ADDON(bookmyshow_addon, BookingEngineBinding)
