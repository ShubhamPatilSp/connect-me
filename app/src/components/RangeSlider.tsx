"use client";

import { useCallback, useId } from "react";

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  /** Two values render a dual-thumb range; one value renders a single thumb. */
  value: [number, number] | number;
  onChange: (value: [number, number] | number) => void;
  format?: (value: number) => string;
  ariaLabel?: string;
}

const pct = (value: number, min: number, max: number) =>
  max === min ? 0 : ((value - min) / (max - min)) * 100;

/**
 * Track-and-fill slider built on two native range inputs.
 *
 * Native inputs give us keyboard support, touch handling and momentum for free;
 * only the thumbs are interactive (`pointer-events` is disabled on the track),
 * so the two layers never fight over a drag.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  format = (v) => String(v),
  ariaLabel,
}: RangeSliderProps) {
  const id = useId();
  const dual = Array.isArray(value);
  const lo = dual ? (value as [number, number])[0] : (value as number);
  const hi = dual ? (value as [number, number])[1] : (value as number);

  const setLo = useCallback(
    (next: number) => {
      if (!dual) return onChange(next);
      onChange([Math.min(next, hi - step), hi] as [number, number]);
    },
    [dual, hi, onChange, step],
  );

  const setHi = useCallback(
    (next: number) => {
      if (!dual) return onChange(next);
      onChange([lo, Math.max(next, lo + step)] as [number, number]);
    },
    [dual, lo, onChange, step],
  );

  const loPct = pct(lo, min, max);
  const hiPct = pct(hi, min, max);

  // When both thumbs sit at the same spot the later input wins the hit test, so
  // lift the lower one while it is pushed up against the upper one.
  const loOnTop = dual && lo > max - (max - min) * 0.15;

  return (
    <div className="rs">
      <div className="rs-track" />
      <div
        className="rs-fill"
        style={
          dual
            ? { left: `${loPct}%`, width: `${Math.max(hiPct - loPct, 0)}%` }
            : { left: 0, width: `${loPct}%` }
        }
      />

      <input
        id={`${id}-lo`}
        className="rs-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={lo}
        aria-label={ariaLabel ? `${ariaLabel} minimum` : "Minimum"}
        aria-valuetext={format(lo)}
        onChange={(e) => setLo(Number(e.target.value))}
        style={{ zIndex: loOnTop ? 5 : 3 }}
      />

      {dual && (
        <input
          id={`${id}-hi`}
          className="rs-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label={ariaLabel ? `${ariaLabel} maximum` : "Maximum"}
          aria-valuetext={format(hi)}
          onChange={(e) => setHi(Number(e.target.value))}
          style={{ zIndex: 4 }}
        />
      )}
    </div>
  );
}
