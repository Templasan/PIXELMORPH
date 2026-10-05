package expo.modules.pixelmorphvideoexport

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord

/** One piece of the timeline, in playback order. Either a video range or a still image held for a while. */
@OptimizedRecord
data class ExportClip(
  @Field val uri: String,
  /** "video" or "image" */
  @Field val kind: String = "video",
  @Field val inMs: Long = 0,
  @Field val outMs: Long = 0,
  /** Only for kind == "image": how long the still is shown. */
  @Field val holdMs: Long = 0,
  @Field val speed: Double = 1.0,
  /** Clockwise degrees: 0, 90, 180, 270. */
  @Field val rotation: Int = 0,
  /** How this clip begins: "fade", "slide", "zoom" or "wipe"; empty for a plain cut. */
  @Field val transitionIn: String = "",
  @Field val transitionInMs: Long = 0,
  /** Last frame of the clip that leaves (JPEG file), laid over this clip while the transition plays. */
  @Field val transitionFrameUri: String = "",
  /** Clockwise degrees the leaving clip was rotated by in the editor. */
  @Field val transitionFrameRotation: Int = 0,
  /** Where this clip starts in the finished video: Media3 hands effects timeline time, not clip time. */
  @Field val startMs: Long = 0
) : Record

@OptimizedRecord
data class ExportAudioClip(
  @Field val uri: String,
  @Field val inMs: Long = 0,
  @Field val outMs: Long = 0,
  /** Where it starts in the finished video. */
  @Field val startMs: Long = 0,
  /** 0..1 */
  @Field val volume: Double = 1.0,
  @Field val fadeInMs: Long = 0,
  @Field val fadeOutMs: Long = 0
) : Record

@OptimizedRecord
data class ExportOptions(
  @Field val clips: List<ExportClip>,
  @Field val audio: List<ExportAudioClip> = emptyList(),
  @Field val width: Int,
  @Field val height: Int,
  /** Target video bitrate in bits per second; 0 lets the encoder pick. */
  @Field val bitrate: Int = 0,
  @Field val outputPath: String
) : Record

@OptimizedRecord
data class ExportResultRecord(
  @Field val uri: String,
  @Field val sizeBytes: Long,
  @Field val durationMs: Long
) : Record
