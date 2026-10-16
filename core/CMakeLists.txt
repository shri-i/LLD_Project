cmake_minimum_required(VERSION 3.16)

project(BookMyShowCore LANGUAGES CXX)

function(bookmyshow_enable_warnings target_name)
    if(MSVC)
        target_compile_options(${target_name} PRIVATE /W4)
    else()
        target_compile_options(${target_name} PRIVATE -Wall -Wextra)
    endif()
endfunction()

include(FetchContent)

find_package(Threads REQUIRED)

if(NOT DEFINED CMAKE_JS_VERSION)
    FetchContent_Declare(
        googletest
        GIT_REPOSITORY https://github.com/google/googletest.git
        GIT_TAG v1.14.0
    )
    FetchContent_MakeAvailable(googletest)
endif()

find_path(NLOHMANN_JSON_INCLUDE_DIR nlohmann/json.hpp)
if(NLOHMANN_JSON_INCLUDE_DIR)
    add_library(bookmyshow_nlohmann_json INTERFACE)
    add_library(nlohmann_json::nlohmann_json ALIAS bookmyshow_nlohmann_json)
    target_include_directories(bookmyshow_nlohmann_json INTERFACE ${NLOHMANN_JSON_INCLUDE_DIR})
else()
    FetchContent_Declare(
        nlohmann_json
        GIT_REPOSITORY https://github.com/nlohmann/json.git
        GIT_TAG v3.11.3
    )
    FetchContent_MakeAvailable(nlohmann_json)
endif()

if(NOT DEFINED CMAKE_JS_VERSION)
    enable_testing()
endif()

add_library(bookmyshow_core
    src/BookingEngine.cpp
    src/observer/EmailNotifier.cpp
    src/observer/SmsNotifier.cpp
    src/services/BookingService.cpp
    src/services/NotificationService.cpp
    src/services/SeatLockManager.cpp
    src/payment/CardPayment.cpp
    src/payment/NetBankingPayment.cpp
    src/payment/PaymentFactory.cpp
    src/payment/UpiPayment.cpp
    src/models/Booking.cpp
    src/models/Show.cpp
    src/models/ShowSeat.cpp
    src/pricing/PeakHourPricing.cpp
    src/pricing/PricingEngine.cpp
    src/pricing/SeatTypePricing.cpp
    src/pricing/WeekendPricing.cpp
    src/refund/FullRefundPolicy.cpp
    src/refund/TieredRefundPolicy.cpp
)

target_include_directories(bookmyshow_core PUBLIC include)
target_compile_features(bookmyshow_core PUBLIC cxx_std_17)
bookmyshow_enable_warnings(bookmyshow_core)
set_target_properties(bookmyshow_core PROPERTIES POSITION_INDEPENDENT_CODE ON)
target_link_libraries(bookmyshow_core PUBLIC Threads::Threads nlohmann_json::nlohmann_json)

if(DEFINED CMAKE_JS_VERSION)
    set(NODE_ADDON_API_INCLUDE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../backend/node_modules/node-addon-api")
    if(NOT EXISTS "${NODE_ADDON_API_INCLUDE_DIR}/napi.h")
        message(FATAL_ERROR "node-addon-api headers not found at ${NODE_ADDON_API_INCLUDE_DIR}; run npm install in backend/")
    endif()

    add_library(bookmyshow_addon SHARED src/bindings/addon.cpp ${CMAKE_JS_SRC})
    set_target_properties(bookmyshow_addon PROPERTIES PREFIX "" SUFFIX ".node")
    target_include_directories(bookmyshow_addon PRIVATE
        ${CMAKE_JS_INC}
        ${NODE_ADDON_API_INCLUDE_DIR}
    )
    target_compile_features(bookmyshow_addon PRIVATE cxx_std_17)
    bookmyshow_enable_warnings(bookmyshow_addon)
    target_compile_definitions(bookmyshow_addon PRIVATE
        NAPI_VERSION=8
        NODE_ADDON_API_CPP_EXCEPTIONS
    )
    target_link_libraries(bookmyshow_addon PRIVATE bookmyshow_core ${CMAKE_JS_LIB})

    if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
        execute_process(
            COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF}
                    /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS}
        )
    endif()
endif()

add_executable(bookmyshow_sample src/main.cpp)
target_compile_features(bookmyshow_sample PRIVATE cxx_std_17)
bookmyshow_enable_warnings(bookmyshow_sample)
target_link_libraries(bookmyshow_sample PRIVATE bookmyshow_core Threads::Threads)

if(NOT DEFINED CMAKE_JS_VERSION)
    include(GoogleTest)
    add_executable(bookmyshow_tests
        tests/BookingEngineTests.cpp
        tests/BookingLifecycleTests.cpp
        tests/PricingAndPaymentTests.cpp
        tests/SeatLockManagerTests.cpp
    )
    target_compile_features(bookmyshow_tests PRIVATE cxx_std_17)
    bookmyshow_enable_warnings(bookmyshow_tests)
    target_link_libraries(bookmyshow_tests PRIVATE bookmyshow_core GTest::gtest_main)
    gtest_discover_tests(bookmyshow_tests)
endif()
