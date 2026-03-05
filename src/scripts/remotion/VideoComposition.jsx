import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

// ─── Utility ────────────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(16,163,127,${alpha})`;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Title Scene ─────────────────────────────────────────────────────────────

const TitleScene = ({ scene, frame, fps, accentColor, bgColor }) => {
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const emojiScale = spring({
    frame,
    fps,
    from: 0.2,
    to: 1,
    config: { damping: 70, stiffness: 180, mass: 1 },
  });
  const titleY = interpolate(frame, [8, 28], [60, 0], {
    extrapolateRight: "clamp",
  });
  const titleOp = interpolate(frame, [8, 28], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subY = interpolate(frame, [22, 42], [40, 0], {
    extrapolateRight: "clamp",
  });
  const subOp = interpolate(frame, [22, 42], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Pulse glow on accent bar
  const glowOp = interpolate(frame, [0, 30, 60], [0.4, 1, 0.4], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(155deg, ${bgColor} 0%, ${hexToRgba(
          accentColor,
          0.18
        )} 60%, ${hexToRgba(accentColor, 0.06)} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 70px",
        opacity: fadeIn,
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 10,
          background: `linear-gradient(90deg, ${accentColor}, ${hexToRgba(accentColor, 0.4)})`,
          boxShadow: `0 0 32px ${hexToRgba(accentColor, glowOp)}`,
        }}
      />

      {/* Decorative background ring */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          border: `2px solid ${hexToRgba(accentColor, 0.08)}`,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          border: `1px solid ${hexToRgba(accentColor, 0.12)}`,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Emoji */}
      {scene.emoji && (
        <div
          style={{
            fontSize: 160,
            transform: `scale(${emojiScale})`,
            marginBottom: 48,
            filter: `drop-shadow(0 12px 40px ${hexToRgba(accentColor, 0.5)})`,
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          {scene.emoji}
        </div>
      )}

      {/* Title */}
      <div
        style={{
          fontSize: 82,
          fontWeight: 900,
          color: "#ffffff",
          textAlign: "center",
          lineHeight: 1.15,
          transform: `translateY(${titleY}px)`,
          opacity: titleOp,
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          letterSpacing: "-1.5px",
          textShadow: "0 4px 24px rgba(0,0,0,0.5)",
          maxWidth: 940,
          zIndex: 1,
        }}
      >
        {scene.heading}
      </div>

      {/* Divider */}
      <div
        style={{
          width: interpolate(frame, [30, 55], [0, 160], {
            extrapolateRight: "clamp",
          }),
          height: 4,
          background: accentColor,
          borderRadius: 2,
          marginTop: 32,
          boxShadow: `0 0 20px ${hexToRgba(accentColor, 0.8)}`,
          zIndex: 1,
        }}
      />

      {/* Subtitle */}
      {scene.subtext && (
        <div
          style={{
            fontSize: 42,
            color: accentColor,
            textAlign: "center",
            marginTop: 28,
            opacity: subOp,
            transform: `translateY(${subY}px)`,
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 500,
            letterSpacing: "0.5px",
            zIndex: 1,
          }}
        >
          {scene.subtext}
        </div>
      )}

      {/* Bottom accent bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 10,
          background: `linear-gradient(90deg, ${hexToRgba(accentColor, 0.4)}, ${accentColor})`,
          boxShadow: `0 0 32px ${hexToRgba(accentColor, glowOp)}`,
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Content Scene ────────────────────────────────────────────────────────────

const ContentScene = ({ scene, frame, fps, accentColor, bgColor }) => {
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const headerY = interpolate(frame, [0, 22], [-50, 0], {
    extrapolateRight: "clamp",
  });
  const headerOp = interpolate(frame, [0, 22], [0, 1], {
    extrapolateRight: "clamp",
  });

  const points = scene.points || [];

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${bgColor} 0%, ${hexToRgba(
          accentColor,
          0.06
        )} 100%)`,
        display: "flex",
        flexDirection: "column",
        padding: "90px 80px",
        opacity: fadeIn,
      }}
    >
      {/* Top accent strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: accentColor,
        }}
      />

      {/* Side accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 6,
          height: interpolate(frame, [5, 35], [0, 1920], {
            extrapolateRight: "clamp",
          }),
          background: `linear-gradient(180deg, ${accentColor}, ${hexToRgba(accentColor, 0)})`,
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          marginTop: 80,
          marginBottom: 72,
          transform: `translateY(${headerY}px)`,
          opacity: headerOp,
        }}
      >
        {scene.emoji && (
          <div
            style={{
              fontSize: 90,
              lineHeight: 1,
              filter: `drop-shadow(0 4px 16px ${hexToRgba(accentColor, 0.5)})`,
            }}
          >
            {scene.emoji}
          </div>
        )}
        <div
          style={{
            fontSize: 62,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.2,
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            flex: 1,
          }}
        >
          {scene.heading}
        </div>
      </div>

      {/* Bullet Points */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 44,
          flex: 1,
        }}
      >
        {points.map((point, i) => {
          const delay = 25 + i * 20;
          const pointOp = interpolate(frame, [delay, delay + 20], [0, 1], {
            extrapolateRight: "clamp",
          });
          const pointX = interpolate(frame, [delay, delay + 20], [-70, 0], {
            extrapolateRight: "clamp",
          });
          const dotScale = spring({
            frame: Math.max(0, frame - delay),
            fps,
            from: 0,
            to: 1,
            config: { damping: 60, stiffness: 200 },
          });

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 32,
                opacity: pointOp,
                transform: `translateX(${pointX}px)`,
              }}
            >
              {/* Dot */}
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: accentColor,
                  flexShrink: 0,
                  marginTop: 16,
                  transform: `scale(${dotScale})`,
                  boxShadow: `0 0 16px ${hexToRgba(accentColor, 0.7)}`,
                }}
              />
              {/* Text */}
              <div
                style={{
                  fontSize: 46,
                  color: "#e8e8e8",
                  lineHeight: 1.45,
                  fontFamily:
                    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 400,
                }}
              >
                {point}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: 80,
          right: 80,
          height: 3,
          background: hexToRgba(accentColor, 0.15),
          borderRadius: 2,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${interpolate(frame, [0, scene.duration || 90], [0, 100], { extrapolateRight: "clamp" })}%`,
            background: accentColor,
            borderRadius: 2,
            boxShadow: `0 0 8px ${hexToRgba(accentColor, 0.8)}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ─── Outro Scene ──────────────────────────────────────────────────────────────

const OutroScene = ({ scene, frame, fps, accentColor, bgColor }) => {
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const outerRingScale = spring({
    frame,
    fps,
    from: 0.6,
    to: 1,
    config: { damping: 80, stiffness: 120 },
  });
  const contentScale = spring({
    frame,
    fps,
    from: 0.8,
    to: 1,
    config: { damping: 90, stiffness: 160 },
  });
  const headingOp = interpolate(frame, [12, 32], [0, 1], {
    extrapolateRight: "clamp",
  });
  const headingY = interpolate(frame, [12, 32], [40, 0], {
    extrapolateRight: "clamp",
  });
  const subOp = interpolate(frame, [28, 48], [0, 1], {
    extrapolateRight: "clamp",
  });
  const lineW = interpolate(frame, [20, 55], [0, 240], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 50%, ${hexToRgba(
          accentColor,
          0.22
        )} 0%, ${bgColor} 65%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px",
        opacity: fadeIn,
      }}
    >
      {/* Animated outer ring */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          border: `2px solid ${hexToRgba(accentColor, 0.1)}`,
          transform: `scale(${outerRingScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 550,
          height: 550,
          borderRadius: "50%",
          border: `2px solid ${hexToRgba(accentColor, 0.18)}`,
          transform: `scale(${outerRingScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 320,
          height: 320,
          borderRadius: "50%",
          border: `2px solid ${hexToRgba(accentColor, 0.3)}`,
          transform: `scale(${outerRingScale})`,
        }}
      />

      {/* Content */}
      <div
        style={{
          transform: `scale(${contentScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          zIndex: 1,
        }}
      >
        {/* Glowing icon */}
        <div
          style={{
            fontSize: 130,
            marginBottom: 52,
            filter: `drop-shadow(0 0 40px ${hexToRgba(accentColor, 0.9)})`,
          }}
        >
          🎯
        </div>

        {/* Heading */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1.2,
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            opacity: headingOp,
            transform: `translateY(${headingY}px)`,
            marginBottom: 32,
            letterSpacing: "-1px",
          }}
        >
          {scene.heading}
        </div>

        {/* Accent line */}
        <div
          style={{
            width: lineW,
            height: 5,
            background: accentColor,
            borderRadius: 3,
            boxShadow: `0 0 24px ${hexToRgba(accentColor, 0.9)}`,
            marginBottom: 32,
          }}
        />

        {/* Subtext */}
        {scene.subtext && (
          <div
            style={{
              fontSize: 46,
              color: accentColor,
              fontFamily:
                "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              opacity: subOp,
              letterSpacing: "0.5px",
            }}
          >
            {scene.subtext}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ─────────────────────────────────────────────────────────

export const VideoComposition = ({
  title = "My Video",
  scenes = [],
  accentColor = "#10a37f",
  bgColor = "#0a0a0a",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find which scene we're currently rendering
  let frameOffset = 0;
  let currentScene = null;
  let currentSceneStart = 0;

  for (const scene of scenes) {
    const duration = scene.duration || 90;
    if (frame < frameOffset + duration) {
      currentScene = scene;
      currentSceneStart = frameOffset;
      break;
    }
    frameOffset += duration;
  }

  // Fall back to last scene if past end
  if (!currentScene && scenes.length > 0) {
    currentScene = scenes[scenes.length - 1];
    currentSceneStart = frameOffset - (currentScene.duration || 90);
  }

  if (!currentScene) {
    return <AbsoluteFill style={{ background: bgColor }} />;
  }

  const sceneFrame = frame - currentSceneStart;
  const commonProps = {
    scene: currentScene,
    frame: sceneFrame,
    fps,
    accentColor,
    bgColor,
  };

  // Cross-fade between scenes (fade out last 8 frames, fade in first 8 frames)
  const sceneDuration = currentScene.duration || 90;
  const fadeOverlap = 8;
  const globalFade = interpolate(
    sceneFrame,
    [0, fadeOverlap, sceneDuration - fadeOverlap, sceneDuration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: bgColor,
        opacity: globalFade,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {currentScene.type === "title" && <TitleScene {...commonProps} />}
      {currentScene.type === "content" && <ContentScene {...commonProps} />}
      {currentScene.type === "outro" && <OutroScene {...commonProps} />}
    </AbsoluteFill>
  );
};
