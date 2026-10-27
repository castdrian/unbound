#include <cstddef>
#include <cstdint>
#include <hermes/hermes.h>
#include <memory>

#include "NativeJSIFuzz.h"

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t *data, std::size_t size)
{
    static auto runtime = facebook::hermes::makeHermesRuntime();
    native_jsi_fuzz::fuzzOne(*runtime, data, size);
    return 0;
}
