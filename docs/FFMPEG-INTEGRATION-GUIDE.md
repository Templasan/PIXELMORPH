# FFmpeg Integration Guide

**Phase 2**: Video Export via RemoteVideoEncoderAdapter

---

## Quick Start

### 1. Set Backend URL

Add to environment:
```bash
# .env or eas.json
FFMPEG_API_URL=https://api.pixelmorph.com
# or locally for testing:
# FFMPEG_API_URL=http://localhost:3000
```

### 2. Wire in CompositionRoot

**File**: `src/app/CompositionRoot.ts`

```typescript
import { RemoteVideoEncoderAdapter } from '@modules/video-editor';

const apiUrl = process.env.EXPO_PUBLIC_FFMPEG_API_URL || 'https://api.pixelmorph.com';
const videoEncoderPort = new RemoteVideoEncoderAdapter(apiUrl);

export const AppCompositionRoot = {
  videoEditor: {
    // ... existing use cases
    encodeVideo: videoEncoderPort,
  },
};
```

### 3. Use in VideoEditorScreen

```typescript
// Already structured in VideoEditorScreen via ExportSheet
// When user taps "Export":
await videoEditor.encodeVideo.encodeVideo(
  frames,     // array of frame URIs (from canvas capture)
  fps,        // 24, 30, 60
  width,      // 1920
  height,     // 1080
  outputPath, // cache path
  quality     // 'low' | 'medium' | 'high'
);
```

---

## Architecture Diagram

```
VideoEditorScreen
    ↓
ExportSheet (UI)
    ↓
VideoEditorModule (use case)
    ↓
VideoEncoderPort (interface)
    ↓
RemoteVideoEncoderAdapter
    ↓ HTTP POST /api/encode-video
Backend FFmpeg Service
    ↓ (submit job)
    ↓ (poll status)
    ↓ (download result)
Device cache (file saved)
    ↓
Gallery or share
```

---

## Frame Capture Flow

1. **Canvas rendering** (Skia)
   - Each frame rendered to SkImage
   - Converted to data: URI (base64)

2. **Frame collection**
   - Array of base64 data URIs
   - ~100-300 frames for 10sec @ 30fps

3. **Submission**
   ```typescript
   await remoteEncoder.encodeVideo(
     ['data:image/png;base64,abc123...', ...],
     30,
     1920, 1080,
     '/cache/video.mp4',
     'high'
   )
   ```

4. **Backend processing**
   - Decodes PNG frames
   - Runs FFmpeg to MP4
   - Uploads to CDN

5. **Polling**
   - Client polls every 2 seconds
   - Max 20 minutes timeout

6. **Result download**
   - Saves to app cache
   - Returns to UI

---

## Configuration Options

### Timeout & Polling

```typescript
const adapter = new RemoteVideoEncoderAdapter(apiUrl);
// Defaults:
// - Poll interval: 2000ms
// - Max attempts: 600 (20 minutes)
```

To customize:
```typescript
class CustomRemoteEncoder extends RemoteVideoEncoderAdapter {
  constructor(apiUrl: string) {
    super(apiUrl);
    this.pollIntervalMs = 5000;      // 5 sec
    this.maxPollAttempts = 120;      // 10 min max
  }
}
```

### Quality Presets

| Quality | Bitrate | Size (10s) | Codec |
|---------|---------|-----------|-------|
| low     | 500kbps | ~6MB      | h264  |
| medium  | 2000kbps| ~25MB     | h264  |
| high    | 5000kbps| ~62MB     | h264  |

---

## Error Handling

```typescript
try {
  await videoEncoder.encodeVideo(frames, fps, width, height, path, quality);
} catch (error) {
  if (error instanceof EncodingError) {
    // Handle backend error
    console.log(error.message);
  }
}
```

Common errors:
- `Backend error 400: Invalid frame count`
- `Backend encoding job failed`
- `Encoding job timed out after 20 minutes`

---

## Testing

### Local Development

1. Start mock backend:
```bash
npm run backend:dev
# Listens on http://localhost:3000
```

2. Point client to local:
```bash
export FFMPEG_API_URL=http://localhost:3000
npm run start
```

3. Trigger export in VideoEditorScreen
4. Watch polling logs in console

### Mock Backend Response

See `docs/BACKEND-FFMPEG-SPEC.md` for example Node.js implementation.

---

## Deployment Checklist

- [ ] Backend service deployed (Lambda, EC2, Docker, etc)
- [ ] FFmpeg installed on backend
- [ ] Storage configured (S3, GCS, local)
- [ ] FFMPEG_API_URL set in eas.json
- [ ] CORS configured if backend separate domain
- [ ] Rate limiting in place
- [ ] Monitoring/logging enabled
- [ ] Tested with real video (5-10 frames minimum)

---

## Alternative: Local FFmpeg (Future)

If migrating to bare workflow:

```typescript
// Path 2 from ADR-004
import { FFmpegEncoderAdapter } from '@modules/video-editor';
const videoEncoder = new FFmpegEncoderAdapter();
```

This would require:
- `expo prebuild --clean`
- `react-native-ffmpeg` package
- Build time increases

For MVP, stick with **RemoteVideoEncoderAdapter** (Path 1).

---

## Rollback Plan

If backend unavailable:
1. Show error: "Video encoding temporarily unavailable"
2. Option to retry or save as image sequence
3. User can encode on desktop later

