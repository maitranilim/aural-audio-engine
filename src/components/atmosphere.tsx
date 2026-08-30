import { tintForGenre, type GenreTint } from "@/lib/genre-tints";

export function Atmosphere({ genre }: { genre?: string }) {
  const tint: GenreTint = tintForGenre(genre);
  return (
    <div className="atmosphere" aria-hidden="true">
      <div
        className="atmosphere-glow"
        style={{
          width: "52vw",
          height: "52vw",
          minWidth: 320,
          minHeight: 320,
          top: "-12%",
          left: "-8%",
          background: tint.glowA,
          animationDuration: "32s",
        }}
      />
      <div
        className="atmosphere-glow"
        style={{
          width: "44vw",
          height: "44vw",
          minWidth: 280,
          minHeight: 280,
          right: "-10%",
          top: "18%",
          background: tint.glowB,
          animationDuration: "26s",
          animationDelay: "-8s",
        }}
      />
      <div
        className="atmosphere-glow"
        style={{
          width: "36vw",
          height: "36vw",
          minWidth: 240,
          minHeight: 240,
          left: "28%",
          bottom: "-18%",
          background: "var(--aural-veil)",
          animationDuration: "36s",
          animationDelay: "-14s",
        }}
      />
      <div className="atmosphere-grain" />
    </div>
  );
}
