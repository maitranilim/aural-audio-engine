import { tintForGenre, type GenreTint } from "@/lib/genre-tints";
import type { CSSProperties } from "react";

type GlowProps = {
  width: string;
  height: string;
  minWidth: number;
  minHeight: number;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  background: string;
  animationDuration: string;
  animationDelay?: string;
};

function AtmosphereGlow({
  width,
  height,
  minWidth,
  minHeight,
  top,
  right,
  bottom,
  left,
  background,
  animationDuration,
  animationDelay,
}: GlowProps) {
  const placementStyle = {
    position: "absolute",
    width,
    height,
    minWidth: `${minWidth}px`,
    minHeight: `${minHeight}px`,
    transform: "translate3d(0, var(--atmosphere-shift-y, 0%), 0)",
    willChange: "transform",
    "--atmosphere-shift-y": "0%",
    ...(top ? { top } : {}),
    ...(right ? { right } : {}),
    ...(bottom ? { bottom } : {}),
    ...(left ? { left } : {}),
  } as CSSProperties;

  return (
    <div className="atmosphere-parallax" data-atmosphere-parallax="true" style={placementStyle}>
      <div
        className="atmosphere-glow"
        style={{
          width: "100%",
          height: "100%",
          background,
          animationDuration,
          ...(animationDelay ? { animationDelay } : {}),
        }}
      />
    </div>
  );
}

export function Atmosphere({ genre }: { genre?: string }) {
  const tint: GenreTint = tintForGenre(genre);
  return (
    <div className="atmosphere" aria-hidden="true">
      <AtmosphereGlow
        width="52vw"
        height="52vw"
        minWidth={320}
        minHeight={320}
        top="-12%"
        left="-8%"
        background={tint.glowA}
        animationDuration="32s"
      />
      <AtmosphereGlow
        width="44vw"
        height="44vw"
        minWidth={280}
        minHeight={280}
        right="-10%"
        top="18%"
        background={tint.glowB}
        animationDuration="26s"
        animationDelay="-8s"
      />
      <AtmosphereGlow
        width="36vw"
        height="36vw"
        minWidth={240}
        minHeight={240}
        left="28%"
        bottom="-18%"
        background="var(--aural-veil)"
        animationDuration="36s"
        animationDelay="-14s"
      />
      <div className="atmosphere-grain" />
    </div>
  );
}
