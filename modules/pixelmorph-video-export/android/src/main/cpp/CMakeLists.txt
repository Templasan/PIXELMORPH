cmake_minimum_required(VERSION 3.22)
project(pmwhisper)
set(CMAKE_CXX_STANDARD 17)

# whisper.cpp 1.9.5, CPU only: the other ggml backends are left out of the copy here.
set(BUILD_SHARED_LIBS OFF)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL OFF CACHE BOOL "" FORCE)
if(ANDROID_ABI STREQUAL "x86_64")
  foreach(flag GGML_SSE42 GGML_AVX GGML_AVX2 GGML_FMA GGML_F16C)
    set(${flag} ON CACHE BOOL "" FORCE)
  endforeach()
endif()
if(ANDROID_ABI STREQUAL "armeabi-v7a")
  # Half-size floats and fused multiply-add, which the model leans on. Every Android 32-bit phone of
  # recent years has them; a much older core without them would stop with an illegal instruction.
  add_compile_options(-mfpu=neon-vfpv4)
endif()
# shortcut: arm64 builds for the baseline every phone has, with no fp16 or dotprod; a variant
# picked at run time would be faster on newer phones, if captions prove slow on a real one.
add_subdirectory(whisper.cpp/ggml)

add_library(pmwhisper SHARED jni.cpp whisper.cpp/src/whisper.cpp whisper.cpp/src/aneforge/whisper-aneforge.cpp)
target_include_directories(pmwhisper PRIVATE whisper.cpp/include whisper.cpp/src)
target_compile_definitions(pmwhisper PRIVATE WHISPER_VERSION="1.9.5")
target_link_libraries(pmwhisper PRIVATE ggml log)
