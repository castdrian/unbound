#include <cstddef>
#include <cstdint>

#include "NativeBridgeFuzz.h"

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t *data, std::size_t size)
{
    native_bridge_fuzz::fuzzOne(data, size);
    return 0;
}
