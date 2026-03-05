import React from "react";
import { Composition } from "remotion";
import { VideoComposition } from "./VideoComposition";

export const RemotionRoot = () => {
  return (
    <Composition
      id="VideoComposition"
      component={VideoComposition}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      calculateMetadata={({ props }) => {
        const totalFrames =
          props.scenes && props.scenes.length > 0
            ? props.scenes.reduce((acc, s) => acc + (s.duration || 90), 0)
            : 300;
        return { durationInFrames: totalFrames };
      }}
      defaultProps={{
        title: "My Video",
        scenes: [
          {
            type: "title",
            duration: 90,
            heading: "My Awesome Video",
            subtext: "Made with Blue J",
            emoji: "🎬",
          },
          {
            type: "content",
            duration: 120,
            heading: "Key Points",
            emoji: "💡",
            points: ["Point one here", "Point two here", "Point three here"],
          },
          {
            type: "outro",
            duration: 90,
            heading: "Follow for more!",
            subtext: "Subscribe now",
          },
        ],
        accentColor: "#10a37f",
        bgColor: "#0a0a0a",
        totalFrames: 300,
      }}
    />
  );
};
