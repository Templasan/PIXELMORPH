#include <jni.h>

#include <atomic>
#include <cstring>

#include "whisper.h"

namespace {

std::atomic<bool> cancelled{false};

struct Call {
  JNIEnv *env;
  jobject listener;
  jmethodID onSegment;
  jmethodID onProgress;
};

// Bytes, not a jstring: a segment can end inside a multi-byte character, which NewStringUTF rejects.
void onSegments(whisper_context *, whisper_state *state, int added, void *user) {
  auto *call = static_cast<Call *>(user);
  const int count = whisper_full_n_segments_from_state(state);
  for (int i = count - added; i < count; i += 1) {
    const char *text = whisper_full_get_segment_text_from_state(state, i);
    const auto size = static_cast<jsize>(std::strlen(text));
    jbyteArray bytes = call->env->NewByteArray(size);
    call->env->SetByteArrayRegion(bytes, 0, size, reinterpret_cast<const jbyte *>(text));
    // whisper counts time in hundredths of a second.
    call->env->CallVoidMethod(call->listener, call->onSegment,
                              static_cast<jlong>(whisper_full_get_segment_t0_from_state(state, i) * 10),
                              static_cast<jlong>(whisper_full_get_segment_t1_from_state(state, i) * 10), bytes);
    call->env->DeleteLocalRef(bytes);
  }
}

void onProgress(whisper_context *, whisper_state *, int percent, void *user) {
  auto *call = static_cast<Call *>(user);
  call->env->CallVoidMethod(call->listener, call->onProgress, static_cast<jint>(percent));
}

}  // namespace

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_pixelmorphvideoexport_WhisperNative_cancel(JNIEnv *, jobject) {
  cancelled = true;
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_pixelmorphvideoexport_WhisperNative_reset(JNIEnv *, jobject) {
  cancelled = false;
}

/** 0 when it ran to the end, 1 cancelled, 2 no model loaded, 3 failed. */
extern "C" JNIEXPORT jint JNICALL
Java_expo_modules_pixelmorphvideoexport_WhisperNative_transcribe(JNIEnv *env, jobject, jstring modelPath,
                                                                 jfloatArray samples, jint threads,
                                                                 jobject listener) {
  const char *model = env->GetStringUTFChars(modelPath, nullptr);
  whisper_context_params contextParams = whisper_context_default_params();
  contextParams.use_gpu = false;
  whisper_context *context = whisper_init_from_file_with_params(model, contextParams);
  env->ReleaseStringUTFChars(modelPath, model);
  if (context == nullptr) return 2;

  jclass type = env->GetObjectClass(listener);
  Call call{env, listener, env->GetMethodID(type, "onSegment", "(JJ[B)V"), env->GetMethodID(type, "onProgress", "(I)V")};

  whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
  params.n_threads = threads;
  params.language = "auto";
  params.print_progress = false;
  params.print_realtime = false;
  params.print_special = false;
  params.print_timestamps = false;
  // Short lines that fit on a video, broken between words.
  params.token_timestamps = true;
  params.max_len = 42;
  params.split_on_word = true;
  params.new_segment_callback = onSegments;
  params.new_segment_callback_user_data = &call;
  params.progress_callback = onProgress;
  params.progress_callback_user_data = &call;
  params.abort_callback = [](void *) { return cancelled.load(); };

  jfloat *pcm = env->GetFloatArrayElements(samples, nullptr);
  const int failed = whisper_full(context, params, pcm, env->GetArrayLength(samples));
  env->ReleaseFloatArrayElements(samples, pcm, JNI_ABORT);
  whisper_free(context);
  if (cancelled) return 1;
  return failed == 0 ? 0 : 3;
}
