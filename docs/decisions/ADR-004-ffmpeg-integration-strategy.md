# ADR-004: FFmpeg Integration Strategy for Video Export

**Date**: 2026-09-22  
**Status**: PROPOSED  
**Context**: Video export requires FFmpeg for encoding, but Expo managed workflow doesn't support native FFmpeg.

## Problem

PixelMorph needs video encoding capabilities for the video editor module. The architecture defines `FFmpegEncoderPort` and `FFmpegDecoderPort`, but integrating actual FFmpeg with React Native is non-trivial.

## Challenge

Expo managed workflow (current setup) does not allow:
- Direct native module usage
- Pre-built native libraries like react-native-ffmpeg
- Complex build configurations

## Decision

Implement a **hybrid approach** with three integration paths:

### Path 1: Backend Processing (Recommended for MVP)

Send video data to a backend service for encoding:

```typescript
export class BackendVideoEncoderAdapter implements VideoEncoderPort {
  async encodeVideo(
    frames: string[],
    fps: number,
    width: number,
    height: number,
    outputPath: string,
    quality: 'low' | 'medium' | 'high'
  ): Promise<void> {
    const response = await fetch('https://api.pixelmorph.com/encode-video', {
      method: 'POST',
      body: JSON.stringify({
        frames: frames.map(uri => uri.split(',')[1]), // base64
        fps, width, height, quality
      })
    });
    
    const encodedUrl = await response.json();
    // Download and save to outputPath
  }
}
```

**Pros**: No app complexity, scalable, supports all codecs  
**Cons**: Network dependent, cloud infrastructure needed

### Path 2: Bare Workflow + react-native-ffmpeg

Eject from managed workflow:

```bash
expo prebuild --clean
npm install react-native-ffmpeg
# Configure native build
```

**Pros**: Full FFmpeg functionality  
**Cons**: Complex setup, build times increase, loses Expo managed benefits

### Path 3: ffmpeg.wasm (Browser/Web only)

For web platform (expo-web):

```typescript
import FFmpeg from '@ffmpeg/ffmpeg';

export class WasmVideoEncoderAdapter implements VideoEncoderPort {
  private ffmpeg = new FFmpeg.FFmpeg();

  async encodeVideo(/* ... */) {
    if (!this.ffmpeg.isLoaded()) {
      await this.ffmpeg.load();
    }
    // Transcode using WASM FFmpeg
  }
}
```

**Pros**: No native code, works on web  
**Cons**: Web only, slower than native, large WASM bundle

## Recommendation for Implementation

**Short-term (MVP)**: Use **Path 1** (Backend Processing)
- Implement `RemoteVideoEncoderAdapter`
- Requires backend service (can be separate project)
- Simplest for Expo managed workflow

**Medium-term**: Add **Path 2** (Bare Workflow) option
- Maintain both adapters
- Let configuration choose which to use
- Enables offline video export

**Long-term**: Consider **Path 3** for web platform
- Separate adapter for web builds
- Fallback when backend unavailable

## Implementation

Current adapters are structured as stubs:

```typescript
// src/modules/video-editor/infrastructure/adapters/FFmpegEncoderAdapter.ts
// Stub with TODO comments indicating integration points
```

To implement **Path 1**, replace with:

```typescript
export class RemoteVideoEncoderAdapter implements VideoEncoderPort {
  constructor(private apiBaseUrl: string) {}

  async encodeVideo(
    frames: string[],
    fps: number,
    width: number,
    height: number,
    outputPath: string,
    quality: 'low' | 'medium' | 'high'
  ): Promise<void> {
    // 1. Upload frames to API
    // 2. Trigger encoding job
    // 3. Poll for completion
    // 4. Download result to outputPath
  }
}
```

## Alternative: Limit Video Export Features

Instead of full video export, consider:
- **Photo export only** (Skia handles this)
- **Video preview generation** (extract single frame)
- **Timeline export as image carousel**

This would eliminate FFmpeg dependency entirely.

## Decision

**Deferred to implementation phase.** For now:
1. Keep current adapter stubs in place
2. Document all three paths
3. Choose Path 1 (backend) as default when implementing
4. Enable switching between adapters via configuration

## Files

- `src/modules/video-editor/infrastructure/adapters/FFmpegEncoderAdapter.ts` (stub)
- `src/modules/video-editor/infrastructure/adapters/FFmpegDecoderAdapter.ts` (stub)
- `src/modules/export/infrastructure/adapters/FFmpegVideoExportAdapter.ts` (stub)

## Related

- [ADR-001: Modular Hexagonal Architecture](./ADR-001-modular-hexagonal-architecture.md)
- [ADR-003: Hexagonal Implementation](./ADR-003-hexagonal-implementation.md)
