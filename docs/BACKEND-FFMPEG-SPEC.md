# Backend FFmpeg Encoding Service Specification

**For**: Phase 2 - Video Export via RemoteVideoEncoderAdapter

---

## Overview

PixelMorph client sends video frames to a backend service for encoding. This decouples CPU-intensive FFmpeg operations from the mobile app.

---

## API Contract

### 1. Submit Encoding Job

**Endpoint**: `POST /api/encode-video`

**Request**:
```json
{
  "frames": [
    "base64_string_frame_1",
    "base64_string_frame_2",
    "..."
  ],
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "quality": "high",
  "codec": "h264",
  "container": "mp4"
}
```

**Response** (202 Accepted):
```json
{
  "jobId": "job_abc123def456"
}
```

**Quality Mapping**:
- `low`: ~500kbps bitrate
- `medium`: ~2000kbps bitrate
- `high`: ~5000kbps bitrate

---

### 2. Poll Job Status

**Endpoint**: `GET /api/encode-video/{jobId}`

**Response** (while processing):
```json
{
  "status": "processing",
  "progress": 45
}
```

**Response** (completed):
```json
{
  "status": "completed",
  "encodedVideoUri": "https://cdn.example.com/videos/job_abc123def456.mp4",
  "durationMs": 30000,
  "fileSizeBytes": 15000000
}
```

**Response** (failed):
```json
{
  "status": "failed",
  "error": "Frame 15 invalid: not PNG/JPEG"
}
```

---

## Implementation Guide

### Node.js + Express Example

```typescript
import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const jobs = new Map(); // jobId → { status, frames, params, result }

// 1. Submit job
app.post('/api/encode-video', express.json(), async (req, res) => {
  const jobId = `job_${uuidv4()}`;
  const { frames, fps, width, height, quality, codec, container } = req.body;

  jobs.set(jobId, {
    status: 'queued',
    frames,
    params: { fps, width, height, quality, codec, container },
  });

  // Start async encoding
  encodeVideoAsync(jobId);

  res.status(202).json({ jobId });
});

// 2. Poll status
app.get('/api/encode-video/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    status: job.status,
    progress: job.progress,
    encodedVideoUri: job.encodedVideoUri,
    durationMs: job.durationMs,
    error: job.error,
  });
});

// 3. Async encoding
async function encodeVideoAsync(jobId: string) {
  const job = jobs.get(jobId);
  job.status = 'processing';

  try {
    // Decode base64 frames, write to temp PNGs
    const tempFrames = await decodeFrames(job.frames);

    // FFmpeg command: PNG sequence → MP4
    const { fps, width, height, quality } = job.params;
    const bitrate = { low: 500, medium: 2000, high: 5000 }[quality];
    
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(`${tmpDir}/frame_%04d.png`)
        .inputFPS(fps)
        .videoCodec('libx264')
        .videoBitrate(bitrate)
        .size(`${width}x${height}`)
        .output(`${tmpDir}/${jobId}.mp4`)
        .on('end', () => resolve(null))
        .on('error', reject)
        .run();
    });

    // Upload to CDN or S3
    const videoUrl = await uploadToStorage(`${tmpDir}/${jobId}.mp4`);

    job.status = 'completed';
    job.encodedVideoUri = videoUrl;
    job.durationMs = (tempFrames.length / fps) * 1000;
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
  }

  // Cleanup in 1 hour
  setTimeout(() => jobs.delete(jobId), 3600000);
}
```

---

## Configuration (PixelMorph)

In CompositionRoot or bootstrap:

```typescript
const apiBaseUrl = process.env.FFMPEG_API_URL || 'https://api.pixelmorph.com';
const videoEncoder = new RemoteVideoEncoderAdapter(apiBaseUrl);
```

---

## Security Considerations

1. **Rate limiting**: Limit frames/min per client
2. **Input validation**: Verify frame dimensions, frame count limits
3. **Storage quota**: Set max output size (e.g., 500MB per job)
4. **Timeout**: Clean up jobs after 24 hours
5. **Authentication**: Add JWT or API key auth if needed

---

## Deployment Notes

- Backend can be Lambda + S3, EC2 + EBS, or containerized
- FFmpeg must be installed: `apt-get install ffmpeg` (Linux) or via Docker
- Recommend queue (Bull, RabbitMQ) for high load
- Stream large videos to S3 pre-signed URLs instead of memory

---

## Monitoring

Track:
- Queue depth (jobs waiting)
- Encoding time (avg, p95)
- Frame errors (format, corruption)
- Storage usage (output files)

---

## Future: Alternative Paths

- **Path 2**: Bare workflow + react-native-ffmpeg (local)
- **Path 3**: ffmpeg.wasm for web (slow, client-side)

Current (Phase 2): **Path 1** (backend) recommended for MVP.

