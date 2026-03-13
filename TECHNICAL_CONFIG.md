# Technical Configuration Reference

## Video Generation System Architecture

### Overview

The video generation system uses **Remotion** (React-based video framework) to create professional MP4 videos from dynamic scene descriptions.

---

## Frame Duration Reference (at 30fps)

| Frames | Duration            | Typical Use        |
| ------ | ------------------- | ------------------ |
| 30     | 1 second            | Fast text reveal   |
| 60     | 2 seconds           | Quick transition   |
| 90     | 3 seconds           | Standard animation |
| 150    | 5 seconds           | Slow animation     |
| 300    | 10 seconds          | Scene duration     |
| 600    | 20 seconds          | Extended scene     |
| 900    | 30 seconds          | Full topic         |
| 1200   | 40 seconds          | Main content       |
| 1800   | 60 seconds          | Long explanation   |
| 9000   | 300 seconds (5 min) | Maximum video      |

---

## Configuration Files & Changes

### 1. Root.jsx - Video Composition Setup

**Location:** `src/scripts/remotion/Root.jsx`

**Key Changes:**

```javascript
// Duration limits
durationInFrames={9000}           // Max 5 minutes (was 300 = 10 sec)
fps={30}                          // 30 frames per second
width={1080}                      // Portrait video width
height={1920}                     // Portrait video height (9:16)

// Default scene durations (in frames)
"title":     duration: 300        // 10 seconds (was 90)
"content":   duration: 600        // 20 seconds (was 120)
"outro":     duration: 300        // 10 seconds (was 90)
```

**Impact:** Enables 5-minute videos with slower default pacing

---

### 2. VideoComposition.jsx - Animation Timing

**Location:** `src/scripts/remotion/VideoComposition.jsx`

**Animation Frame Ranges (Title Scene):**

```javascript
// Fade in: Much slower entrance
fadeIn: [0, 60]; // 2 seconds (was [0, 18])

// Title slide animation: 3x slower
titleY: [30, 120]; // 3 seconds (was [8, 28])
titleOp: [30, 120]; // 3 seconds

// Subtitle animation: 3x slower
subY: [80, 170]; // 3 seconds (was [22, 42])
subOp: [80, 170]; // 3 seconds

// Accent bar glow: Smoother pulse
glowOp: [0, 150, 300]; // 10 second cycle (was [0, 30, 60])

// Divider reveal: 2.7x slower
width: [100, 200]; // 3.3 seconds (was [30, 55])
```

**Content Scene Updates:**

```javascript
// Header animation: 4.5x slower
headerOp: [0, 100]; // 3.3 seconds (was [0, 22])
headerY: [0, 100]; // Matches opacity timing

// Bullet points: Much slower stagger
delay = 120 + i * 80; // 4x slower reveal (was 25 + i*20)
pointOp: [delay, delay + 60]; // 2 seconds per point (was +20)
pointX: [delay, delay + 60]; // Smooth slide-in
```

**Outro Scene Updates:**

```javascript
// Heading: 4.3x slower
headingOp: [60, 140]; // 2.7 seconds (was [12, 32])
headingY: [60, 140]; // Matches opacity

// Subtext: 4.2x slower
subOp: [120, 200]; // 2.7 seconds (was [28, 48])

// Accent line: 2.6x slower
lineW: [80, 180]; // 3.3 seconds (was [20, 55])
```

**Impact:** Professional cinematic transitions instead of jarring quick changes

---

### 3. main/index.js - Render Quality Settings

**Location:** `src/main/index.js`

**Render Configuration:**

```javascript
await renderMedia({
  codec: "h264", // Universal video codec
  pixelFormat: "yuv420p", // Standard video format
  // Compatible with all players
  videoBitrate: "8000k", // 8 Mbps (high quality)
  // YouTube recommends 7-8 Mbps for 1080p
  audioBitrate: "192k", // Professional audio (48kHz sample rate)
  outputLocation: outputPath, // Save to temp folder
  inputProps, // Scene data
  browserExecutable, // Chrome/Chromium
  concurrency: 2, // Parallel rendering threads
  onProgress: callback, // Progress updates to UI
});
```

**Quality Impact:**

- **8000k bitrate:** High quality at 1080p (directly visible)
- **yuv420p format:** Optimal for streaming
- **192k audio:** Professional quality audio

**Bitrate Reference:**

```
Bitrate    |  Quality       |  Use Case
2-4 Mbps   |  Good          |  YouTube streaming
5-8 Mbps   |  Very High     |  YouTube uploads ✅ Current
8-15 Mbps  |  Excellent     |  High-quality archival
15+ Mbps   |  Lossless      |  Professional archival
```

---

### 4. chat.js - AI Prompt & Defaults

**Location:** `src/renderer/js/chat.js`

**Updated Scene Prompt:**

```javascript
// Default durations in JSON template (frames at 30fps)
title: duration: 300; // 10 seconds (was 60 = 2 sec)
content: duration: 600; // 20 seconds (was 90 = 3 sec)
outro: duration: 300; // 10 seconds (was 60 = 2 sec)

// Total duration limit
("Total scene durations must sum to ≤ 9000"); // 5 min (was ≤ 300)

// Default fallback
duration: Number(s.duration) || 300; // 10 seconds (was 90)
```

**Prompt Updates:**

```
Rules provided to AI:
- Generate scenes with proper pacing
- Maximum 1-3 content scenes
- Use emoji to enhance visual appeal
- Keep headings concise (≤6 words)
- Provide 2-4 bullet points per content scene
```

---

## Scene Structure Reference

### Basic Scene Format:

```json
{
  "title": "Video Title",
  "accentColor": "#10a37f",
  "bgColor": "#0a0a0a",
  "scenes": [
    {
      "type": "title|content|outro",
      "duration": 300,
      "heading": "Scene Title",
      "subtext": "Optional subtitle",
      "emoji": "🎯",
      "points": ["Point 1", "Point 2"]
    }
  ]
}
```

### Duration Calculation:

```
Total Duration (seconds) = Total Frames / 30fps

Examples:
- 300 frames / 30 = 10 seconds
- 900 frames / 30 = 30 seconds
- 1800 frames / 30 = 60 seconds (1 minute)
- 9000 frames / 30 = 300 seconds (5 minutes)
```

---

## Performance Metrics

### Rendering Performance

```
System Requirements:
- CPU: Multi-core (4+ cores recommended)
- RAM: 4GB+ (8GB recommended)
- Disk: 5GB free space
- Browser: Chrome/Chromium (used for rendering)

Rendering Time Estimates:
Video Length | CPU Time | Real Time*
30 seconds   | 2-5 min  | 1-2 min (with caching)
60 seconds   | 4-10 min | 2-4 min
2 minutes    | 8-20 min | 5-10 min
5 minutes    | 20-50 min| 15-30 min

* Real time depends on system load and CPU performance
* First render slower due to setup; subsequent renders faster
```

---

## Video Output Specifications

### Resolution & Format:

```
Aspect Ratio: 9:16 (vertical/portrait)
Resolution: 1920x1080 pixels
- Width: 1080px
- Height: 1920px

Format: MP4
Codec: H.264 (AVC)
Container: MPEG-4

Audio:
- Codec: AAC
- Bitrate: 192 kbps
- Sample Rate: 48 kHz
- Channels: 2 (Stereo)
```

### YouTube Compatibility:

```
✅ Recommended resolution: 1920x1080 (yours)
✅ Recommended bitrate: 7-8 Mbps (yours is 8 Mbps)
✅ Recommended codec: H.264 (yours)
✅ Container: MP4 (yours)
✅ Frame rate: 30fps (optimal)
✅ Pixel format: yuv420p (yours)

Result: No re-encoding needed on YouTube
        Direct upload with highest quality
```

---

## Troubleshooting Configuration

### Slower Video Generation:

```javascript
// Reduce concurrency (uses less CPU)
concurrency: 1,  // Instead of 2

// Reduce bitrate (smaller file, faster)
videoBitrate: "5000k",  // Instead of "8000k"

// Lower quality (faster rendering)
crf: 23,  // Instead of 18 (YouTube default)
```

### Faster Video Generation:

```javascript
// More concurrency (use more CPU)
concurrency: 4,  // Use 4 threads if CPU allows

// Increase resolution
width: 1080,  // Already at good level
height: 1920,

// Better CPU cooling to maintain speed
```

### File Size Reference:

```
At 8000k bitrate + 192k audio:

Video Duration | Approx File Size
30 seconds     | 30-40 MB
1 minute       | 65-75 MB
2 minutes      | 130-150 MB
3 minutes      | 195-225 MB
5 minutes      | 325-375 MB

Great for YouTube (no upload issues!)
Good for downloading & sharing
```

---

## Animation Interpolation Guide

### Interpolation Syntax:

```javascript
interpolate(
  frame, // Current frame number
  [inputStart, inputEnd], // Frame range for input
  [outputStart, outputEnd], // Value range for output
  { extrapolateRight: "clamp" }, // Behavior beyond range
);
```

### Timing Examples:

```javascript
// 1 second entrance (30 frames)
interpolate(frame, [0, 30], [0, 1]);

// 2 second entrance (60 frames)
interpolate(frame, [0, 60], [0, 1]);

// Staggered reveal (bullet points)
// Bullet 1: frame 120-180 (2 sec)
// Bullet 2: frame 200-260 (2 sec)
// Bullet 3: frame 280-340 (2 sec)
```

---

## Color System

### Recommended Accent Colors:

```javascript
{
  "primary": "#10a37f",    // Teal (default)
  "secondary": "#ef4444",  // Red
  "accent": "#fbbf24",     // Gold
  "success": "#34a853",    // Green
  "dark": "#1f2937",       // Dark Gray
  "light": "#f3f4f6",      // Light Gray
  "white": "#ffffff"       // White
}
```

### Background Colors:

```
"#0a0a0a" - Pure black (high contrast)
"#1a1a1a" - Very dark gray (easier on eyes)
"#2d3748" - Dark blue-gray (professional)
```

---

## Export & Deployment

### YouTube Upload Checklist:

```
✅ Format: MP4
✅ Resolution: 1920x1080
✅ Bitrate: 8000 kbps (high quality)
✅ Codec: H.264
✅ Audio: Included (192 kbps)
✅ Pixel Format: yuv420p
✅ Duration: Up to 5 minutes
✅ File Size: Under 500 MB
```

### Download Location:

```
Windows: C:\Users\[User]\AppData\Local\Temp\
macOS:   /var/folders/[hash]/T/
Linux:   /tmp/

Filename: video_[timestamp].mp4
```

---

## Advanced Customization

### To Adjust Animation Speed Globally:

Multiply frame ranges by a factor:

```javascript
// Make all animations 2x slower
[0, 30] → [0, 60]
[12, 32] → [24, 64]

// Make animations 1.5x slower
[0, 30] → [0, 45]
```

### To Add New Scene Types:

1. Create new component in VideoComposition.jsx
2. Add scene type to compositor
3. Update Root.jsx with new type
4. Update chat.js AI prompt

---

## Monitoring & Debugging

### Check Video Generation Progress:

Progress messages sent during rendering:

```
"Downloading Chromium..." → First time setup
"Setting up video engine..." → Bundling React
"Rendering… 0%" → Began frame render
"Rendering… 50%" → Halfway done
"Rendering… 100%" → Complete
```

### Common Issues & Solutions:

| Issue               | Cause        | Solution                       |
| ------------------- | ------------ | ------------------------------ |
| Very slow rendering | Low CPU      | Reduce concurrency, close apps |
| Out of memory       | Large video  | Reduce resolution or duration  |
| Bad quality         | Low bitrate  | Increase videoBitrate          |
| File too large      | High bitrate | Reduce crf to 23               |

---

**Configuration Reference Complete** 📋

For usage examples, see VIDEO_USAGE_GUIDE.md
For overview, see VIDEO_QUALITY_IMPROVEMENTS.md
