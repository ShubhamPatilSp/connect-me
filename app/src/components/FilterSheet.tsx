"use client";

import { useEffect, useState } from "react";

import { RangeSlider } from "@/components/RangeSlider";
import { Sheet } from "@/components/overlays";

export interface FilterPrefs {
  ageMin: number;
  ageMax: number;
  distance: number;
  verifiedOnly: boolean;
}

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  initial: FilterPrefs;
  onApply: (prefs: FilterPrefs) => void | Promise<void>;
  saving?: boolean;
}

/**
 * Shared discovery-filter sheet.
 *
 * Lives in one place so the deck and the settings screen cannot drift apart —
 * they previously carried two copies of the same form.
 */
export function FilterSheet({ open, onClose, initial, onApply, saving }: FilterSheetProps) {
  const [prefs, setPrefs] = useState<FilterPrefs>(initial);

  useEffect(() => {
    if (open) setPrefs(initial);
    // Re-sync only when the sheet opens or the saved values change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial.ageMin, initial.ageMax, initial.distance, initial.verifiedOnly]);

  const changed =
    prefs.ageMin !== initial.ageMin ||
    prefs.ageMax !== initial.ageMax ||
    prefs.distance !== initial.distance ||
    prefs.verifiedOnly !== initial.verifiedOnly;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Discovery filters"
      subtitle="Connect Me never shows anyone outside Khandesh."
    >
      <div className="filter-section">
        <div className="filter-head">
          <span className="filter-label">Age range</span>
          <span className="filter-value">
            {prefs.ageMin} – {prefs.ageMax}
          </span>
        </div>
        <RangeSlider
          min={18}
          max={60}
          value={[prefs.ageMin, prefs.ageMax]}
          ariaLabel="Age range"
          onChange={(value) => {
            const [ageMin, ageMax] = value as [number, number];
            setPrefs((p) => ({ ...p, ageMin, ageMax }));
          }}
        />
        <div className="filter-scale">
          <span>18</span>
          <span>60</span>
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-head">
          <span className="filter-label">Maximum distance</span>
          <span className="filter-value">{prefs.distance} km</span>
        </div>
        <RangeSlider
          min={5}
          max={120}
          step={5}
          value={prefs.distance}
          ariaLabel="Maximum distance"
          format={(v) => `${v} km`}
          onChange={(value) => setPrefs((p) => ({ ...p, distance: value as number }))}
        />
        <div className="filter-scale">
          <span>5 km</span>
          <span>120 km</span>
        </div>
      </div>

      <div className="switch-row" style={{ borderBottom: "1px solid var(--line)" }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em" }}>
            Verified profiles only
          </div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
            Only people who passed photo verification
          </div>
        </div>
        <button
          className="switch"
          data-on={prefs.verifiedOnly}
          onClick={() => setPrefs((p) => ({ ...p, verifiedOnly: !p.verifiedOnly }))}
          aria-label="Verified profiles only"
          aria-pressed={prefs.verifiedOnly}
        />
      </div>

      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 20 }}
        onClick={() => void onApply(prefs)}
        disabled={saving}
      >
        {saving ? "Applying…" : changed ? "Apply filters" : "Done"}
      </button>
    </Sheet>
  );
}
