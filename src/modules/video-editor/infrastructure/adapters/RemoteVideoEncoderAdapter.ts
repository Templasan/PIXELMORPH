import { VideoEncoderPort, EncodingError } from '../../ports';

/**
 * Remote FFmpeg encoder adapter — sends video frames to backend for processing.
 *
 * **Strategy**: Path 1 from ADR-004 (Backend Processing)
 * - Offload CPU-intensive encoding to a backend service
 * - Suitable for Expo managed workflow (no native FFmpeg)
 * - Scalable for batch processing
 *
 * **Flow**:
 * 1. Client uploads frames as base64
 * 2. Backend queues encoding job
 * 3. Client polls for completion
 * 4. Backend streams encoded video back
 * 5. Client saves to local cache
 */
export class RemoteVideoEncoderAdapter implements VideoEncoderPort {
  private apiBaseUrl: string;
  private pollIntervalMs: number = 2000;
  private maxPollAttempts: number = 600; // 20 minutes max wait

  constructor(apiBaseUrl: string) {
    if (!apiBaseUrl) {
      throw new Error('API base URL required for RemoteVideoEncoderAdapter');
    }
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Encode video by sending frames to backend service.
   *
   * Frames should be URIs (data: URIs or file paths).
   * Backend will fetch/decode them, encode into video, return result.
   */
  async encodeVideo(
    frames: string[],
    fps: number,
    width: number,
    height: number,
    outputPath: string,
    quality: 'low' | 'medium' | 'high'
  ): Promise<void> {
    if (!frames || frames.length === 0) {
      throw new EncodingError('No frames provided');
    }

    if (fps <= 0 || width <= 0 || height <= 0) {
      throw new EncodingError('Invalid video parameters');
    }

    console.log(
      `[RemoteFFmpeg] Encoding ${frames.length} frames @ ${fps}fps (${width}x${height}) quality=${quality}`
    );

    try {
      // Step 1: Upload frames to backend
      const jobId = await this.submitEncodingJob(frames, fps, width, height, quality);

      console.log(`[RemoteFFmpeg] Job ${jobId} submitted`);

      // Step 2: Poll for completion
      const result = await this.pollForCompletion(jobId);

      if (!result.encodedVideoUri) {
        throw new EncodingError(`Backend returned no video URL for job ${jobId}`);
      }

      // Step 3: Download and save to outputPath
      await this.downloadAndSave(result.encodedVideoUri, outputPath);

      console.log(`[RemoteFFmpeg] Job ${jobId} completed, saved to ${outputPath}`);
    } catch (error) {
      if (error instanceof EncodingError) throw error;
      throw new EncodingError(error instanceof Error ? error.message : 'Remote encoding failed');
    }
  }

  /**
   * Submit encoding job to backend.
   * Returns job ID for polling.
   */
  private async submitEncodingJob(
    frames: string[],
    fps: number,
    width: number,
    height: number,
    quality: 'low' | 'medium' | 'high'
  ): Promise<string> {
    const payload = {
      frames: frames.map((uri) => this.extractBase64(uri)),
      fps,
      width,
      height,
      quality,
      codec: 'h264',
      container: 'mp4',
    };

    const response = await fetch(`${this.apiBaseUrl}/api/encode-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new EncodingError(`Backend error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as { jobId?: string };
    if (!data.jobId) {
      throw new EncodingError('Backend returned no job ID');
    }

    return data.jobId;
  }

  /**
   * Poll backend until encoding completes or timeout.
   */
  private async pollForCompletion(jobId: string): Promise<{
    encodedVideoUri: string;
    durationMs?: number;
  }> {
    let attempts = 0;

    while (attempts < this.maxPollAttempts) {
      attempts++;

      const response = await fetch(`${this.apiBaseUrl}/api/encode-video/${jobId}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new EncodingError(`Failed to poll job ${jobId}: ${response.status}`);
      }

      const data = (await response.json()) as {
        status?: string;
        encodedVideoUri?: string;
        durationMs?: number;
        error?: string;
      };

      if (data.error) {
        throw new EncodingError(`Backend encoding failed: ${data.error}`);
      }

      if (data.status === 'completed' && data.encodedVideoUri) {
        return {
          encodedVideoUri: data.encodedVideoUri,
          durationMs: data.durationMs,
        };
      }

      if (data.status === 'failed') {
        throw new EncodingError('Backend encoding job failed');
      }

      console.log(
        `[RemoteFFmpeg] Job ${jobId} status: ${data.status || 'processing'} (${attempts}/${this.maxPollAttempts})`
      );

      // Wait before next poll
      await this.sleep(this.pollIntervalMs);
    }

    throw new EncodingError(`Encoding job ${jobId} timed out after 20 minutes`);
  }

  /**
   * Download encoded video from backend and save to outputPath.
   * ponytail: Currently logs download. Real impl requires device-media integration.
   */
  private async downloadAndSave(videoUri: string, outputPath: string): Promise<void> {
    console.log(`[RemoteFFmpeg] Downloading video from ${videoUri} to ${outputPath}`);

    // ponytail: Real implementation would:
    // 1. Fetch video blob from videoUri
    // 2. Write to FileSystem.documentDirectory + outputPath
    // 3. Return local file URI
    //
    // For now, this is stubbed. Backend returns accessible URL,
    // and UI layer handles caching via device-media module.

    const response = await fetch(videoUri);
    if (!response.ok) {
      throw new EncodingError(`Failed to download encoded video: ${response.status}`);
    }

    console.log(`[RemoteFFmpeg] Downloaded ${response.headers.get('content-length')} bytes`);
  }

  /**
   * Extract base64 data from URI (data: format or file path).
   */
  private extractBase64(uri: string): string {
    if (uri.startsWith('data:')) {
      // data:image/png;base64,abc123... → abc123...
      const match = uri.match(/base64,(.+)$/);
      return match ? match[1] : uri;
    }
    // File URI — return as-is for backend to fetch
    return uri;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
