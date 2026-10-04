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
  @Field val rotation: Int = 0
) : Record

/**
 * A still laid over the main timeline for `durationMs` from `startMs` and animated away: the
 * previous clip's last frame while a transition into the next clip plays.
 */
@OptimizedRecord
data class ExportOverlay(
  @Field val uri: String,
  @Field val startMs: Long,
  @Field val durationMs: Long,
  /** "fade", "slide", "zoom" or "wipe" */
  @Field val type: String,
  @Field val rotation: Int = 0
) : Record

@OptimizedRecord
data class ExportOptions(
  @Field val clips: List<ExportClip>,
  @Field val width: Int,
  @Field val height: Int,
  /** Target video bitrate in bits per second; 0 lets the encoder pick. */
  @Field val bitrate: Int = 0,
  @Field val outputPath: String,
  @Field val overlays: List<ExportOverlay> = emptyList()
) : Record

@OptimizedRecord
data class ExportResultRecord(
  @Field val uri: String,
  @Field val sizeBytes: Long,
  @Field val durationMs: Long
) : Record
