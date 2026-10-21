"use client";

import { useEffect, useState } from "react";

import styles from "./LocationPicker.module.css";

export interface LocationValue {
  label: string;
  lat: number;
  lng: number;
}

interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

interface LocationPickerProps {
  value: LocationValue | null;
  onChange: (location: LocationValue) => void;
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coordinatesOpen, setCoordinatesOpen] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [coordinateLabel, setCoordinateLabel] = useState("");
  const [gpsBusy, setGpsBusy] = useState(false);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          name: search,
          count: "6",
          language: "en",
          format: "json",
        });
        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Location search is temporarily unavailable");
        const data = (await response.json()) as { results?: GeocodingResult[] };
        setResults(data.results ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not search locations");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const useGps = () => {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser");
      return;
    }
    setGpsBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onChange({ label: "Current location", lat: coords.latitude, lng: coords.longitude });
        setGpsBusy(false);
      },
      (positionError) => {
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Allow location access or search for a city instead"
            : "Could not get your location. Search for a city instead",
        );
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  const useCoordinates = () => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (
      latitude.trim() === "" ||
      longitude.trim() === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setError("Enter a valid latitude (-90 to 90) and longitude (-180 to 180)");
      return;
    }
    onChange({
      label: coordinateLabel.trim() || "Custom location",
      lat,
      lng,
    });
    setError(null);
  };

  const chooseResult = (result: GeocodingResult) => {
    const label = [result.name, result.admin1, result.country]
      .filter((part, index, parts) => Boolean(part) && parts.indexOf(part) === index)
      .join(", ");
    onChange({ label, lat: result.latitude, lng: result.longitude });
    setQuery("");
    setResults([]);
    setError(null);
  };

  return (
    <div className={styles.picker}>
      <button className="btn btn-ghost btn-block" onClick={useGps} disabled={gpsBusy}>
        {gpsBusy ? "Getting location…" : "Use my current location"}
      </button>

      <div className={styles.separator}>or search worldwide</div>
      <label className={styles.label} htmlFor="location-search">
        City or town
      </label>
      <input
        id="location-search"
        className="input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search city or town"
        autoComplete="off"
      />

      {loading && <p className={styles.note}>Searching locations…</p>}
      {results.length > 0 && (
        <div className={styles.results} aria-label="Location search results">
          {results.map((result) => (
            <button
              className={styles.result}
              key={result.id}
              onClick={() => chooseResult(result)}
            >
              {[result.name, result.admin1, result.country]
                .filter((part, index, parts) => Boolean(part) && parts.indexOf(part) === index)
                .join(", ")}
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && !loading && results.length === 0 && !error && (
        <p className={styles.note}>No matching locations found</p>
      )}

      <button
        className={styles.link}
        onClick={() => {
          setCoordinatesOpen((open) => !open);
          setError(null);
        }}
      >
        {coordinatesOpen ? "Hide coordinate entry" : "Enter coordinates instead"}
      </button>
      {coordinatesOpen && (
        <div className={styles.coordinateFields}>
          <label className={styles.label} htmlFor="location-label">
            Location label (optional)
          </label>
          <input
            id="location-label"
            className="input"
            value={coordinateLabel}
            onChange={(event) => setCoordinateLabel(event.target.value)}
            maxLength={120}
            placeholder="City, country"
          />
          <div className={styles.coordinateRow}>
            <input
              className="input"
              inputMode="decimal"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              placeholder="Latitude"
              aria-label="Latitude"
            />
            <input
              className="input"
              inputMode="decimal"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              placeholder="Longitude"
              aria-label="Longitude"
            />
          </div>
          <button className="btn btn-ghost btn-block" onClick={useCoordinates}>
            Use these coordinates
          </button>
        </div>
      )}

      {value && (
        <p className={styles.selected}>
          Selected: {value.label} ({value.lat.toFixed(3)}, {value.lng.toFixed(3)})
        </p>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.attribution}>
        City search is sent to Open-Meteo / GeoNames. GPS coordinates are shared with Connect Me
        only. City data: Open-Meteo · GeoNames.
      </p>
    </div>
  );
}
