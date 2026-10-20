"use client";

import { useEffect, useMemo, useState } from "react";

const PALETTES: Array<[string, string, string]> = [
  ["#FF8A4C", "#E2382A", "#3A0B08"],
  ["#7C5CFF", "#4B2FC4", "#120A33"],
  ["#FF6A3D", "#8F1A12", "#2A0705"],
  ["#2DD4A7", "#0E6B55", "#04241C"],
  ["#F5A524", "#A34E08", "#2E1403"],
  ["#F472B6", "#9D174D", "#2B0A18"],
  ["#60A5FA", "#1D4ED8", "#08122E"],
];

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PortraitProps {
  seed: string;
  name: string;
  variant?: "card" | "avatar";
  className?: string;
}

/**
 * Deterministic portrait art.
 *
 * Used when a profile photo is missing or fails to load. Rather than showing a
 * broken image, every profile gets a stable, brand-consistent composition
 * derived from its id — same person always renders the same art.
 */
export function Portrait({ seed, name, variant = "card", className }: PortraitProps) {
  const { colors, id } = useMemo(() => {
    const h = hash(seed || name);
    return { colors: PALETTES[h % PALETTES.length], id: `p${h % 100000}` };
  }, [seed, name]);

  if (variant === "avatar") {
    return (
      <svg
        className={className}
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        role="img"
        aria-label={name}
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={`ag-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#ag-${id})`} />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="38"
          fontWeight="600"
          fill="rgba(255,255,255,0.94)"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {initials(name)}
        </text>
      </svg>
    );
  }

  const female = hash(`${seed}${name}`) % 2 === 0;

  return (
    <svg
      className={className}
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      role="img"
      aria-label={name}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="58%" stopColor={colors[1]} />
          <stop offset="100%" stopColor={colors[2]} />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.72" cy="0.22" r="0.72">
          <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <linearGradient id={`sil-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(8,8,10,0.16)" />
          <stop offset="100%" stopColor="rgba(8,8,10,0.58)" />
        </linearGradient>
        <filter id={`grain-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>

      <rect width="300" height="400" fill={`url(#bg-${id})`} />
      <rect width="300" height="400" fill={`url(#glow-${id})`} />

      <g fill={`url(#sil-${id})`}>
        <path d="M34 400c0-84 46-142 116-142s116 58 116 142z" />
        <rect x="128" y="186" width="44" height="86" rx="20" />
        {female ? (
          <ellipse cx="150" cy="148" rx="66" ry="72" />
        ) : (
          <ellipse cx="150" cy="140" rx="57" ry="58" />
        )}
        <circle cx="150" cy="146" r="46" fill={`url(#bg-${id})`} opacity="0.55" />
      </g>

      <rect width="300" height="400" filter={`url(#grain-${id})`} opacity="0.06" />
    </svg>
  );
}

interface PhotoProps {
  src?: string | null;
  seed: string;
  name: string;
  alt?: string;
  className?: string;
  variant?: "card" | "avatar";
}

/** Image with a graceful, always-available fallback. */
export function Photo({ src, seed, name, alt, className, variant = "card" }: PhotoProps) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!src) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    // A slow or blocked CDN should never leave an empty tile on screen.
    const timer = setTimeout(() => {
      setStatus((current) => (current === "loading" ? "error" : current));
    }, 3000);
    return () => clearTimeout(timer);
  }, [src]);

  if (!src || status === "error") {
    return <Portrait seed={seed} name={name} variant={variant} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? name}
      className={className}
      onLoad={() => setStatus("ok")}
      onError={() => setStatus("error")}
      loading="lazy"
      decoding="async"
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}
