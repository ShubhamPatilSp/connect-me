/** Legacy city coordinates used for built-in demo profiles. */

export type District = "Jalgaon" | "Dhule" | "Nandurbar";

export interface KhandeshCity {
  id: string;
  name: string;
  /** Local (Marathi) spelling, used in the UI for cultural grounding. */
  local: string;
  district: District;
  lat: number;
  lng: number;
  /** Relative population weight, used to balance the candidate queue. */
  weight: number;
}

export const KHANDESH_CITIES: readonly KhandeshCity[] = [
  // ── Jalgaon district ──────────────────────────────────────────────────────
  { id: "jalgaon", name: "Jalgaon", local: "जळगाव", district: "Jalgaon", lat: 21.0077, lng: 75.5626, weight: 10 },
  { id: "bhusawal", name: "Bhusawal", local: "भुसावळ", district: "Jalgaon", lat: 21.0435, lng: 75.785, weight: 7 },
  { id: "amalner", name: "Amalner", local: "अमळनेर", district: "Jalgaon", lat: 21.04, lng: 75.06, weight: 5 },
  { id: "chalisgaon", name: "Chalisgaon", local: "चाळीसगाव", district: "Jalgaon", lat: 20.457, lng: 75.016, weight: 5 },
  { id: "pachora", name: "Pachora", local: "पाचोरा", district: "Jalgaon", lat: 20.667, lng: 75.35, weight: 4 },
  { id: "jamner", name: "Jamner", local: "जामनेर", district: "Jalgaon", lat: 20.809, lng: 75.78, weight: 4 },
  { id: "parola", name: "Parola", local: "परोळा", district: "Jalgaon", lat: 20.88, lng: 75.12, weight: 3 },
  { id: "chopda", name: "Chopda", local: "चोपडा", district: "Jalgaon", lat: 21.247, lng: 75.3, weight: 4 },
  { id: "yawal", name: "Yawal", local: "यावल", district: "Jalgaon", lat: 21.168, lng: 75.7, weight: 3 },
  { id: "raver", name: "Raver", local: "रावेर", district: "Jalgaon", lat: 21.233, lng: 76.033, weight: 3 },
  { id: "faizpur", name: "Faizpur", local: "फैजपूर", district: "Jalgaon", lat: 21.166, lng: 75.85, weight: 2 },
  { id: "savda", name: "Savda", local: "सावदा", district: "Jalgaon", lat: 21.15, lng: 75.883, weight: 2 },
  { id: "shindkheda", name: "Shindkheda", local: "शिंदखेडा", district: "Jalgaon", lat: 21.033, lng: 74.733, weight: 2 },
  { id: "bhadgaon", name: "Bhadgaon", local: "भडगाव", district: "Jalgaon", lat: 20.666, lng: 75.233, weight: 2 },
  { id: "dharangaon", name: "Dharangaon", local: "धरणगाव", district: "Jalgaon", lat: 21.016, lng: 75.283, weight: 2 },
  { id: "erandol", name: "Erandol", local: "एरंडोल", district: "Jalgaon", lat: 20.92, lng: 75.333, weight: 2 },
  { id: "muktainagar", name: "Muktainagar", local: "मुक्ताईनगर", district: "Jalgaon", lat: 21.05, lng: 76.05, weight: 2 },

  // ── Dhule district ────────────────────────────────────────────────────────
  { id: "dhule", name: "Dhule", local: "धुळे", district: "Dhule", lat: 20.9042, lng: 74.7749, weight: 9 },
  { id: "shirpur", name: "Shirpur", local: "शिरपूर", district: "Dhule", lat: 21.348, lng: 74.88, weight: 5 },
  { id: "dondaicha", name: "Dondaicha", local: "दोंडाईचा", district: "Dhule", lat: 21.316, lng: 74.566, weight: 3 },
  { id: "sakri", name: "Sakri", local: "साक्री", district: "Dhule", lat: 20.983, lng: 74.316, weight: 3 },
  { id: "sindkheda", name: "Sindkheda", local: "सिंदखेडा", district: "Dhule", lat: 21.0, lng: 74.6, weight: 2 },

  // ── Nandurbar district ────────────────────────────────────────────────────
  { id: "nandurbar", name: "Nandurbar", local: "नंदुरबार", district: "Nandurbar", lat: 21.3667, lng: 74.24, weight: 8 },
  { id: "shahada", name: "Shahada", local: "शहादा", district: "Nandurbar", lat: 21.545, lng: 74.466, weight: 4 },
  { id: "taloda", name: "Taloda", local: "तळोदा", district: "Nandurbar", lat: 21.56, lng: 74.21, weight: 3 },
  { id: "navapur", name: "Navapur", local: "नवापूर", district: "Nandurbar", lat: 21.166, lng: 73.783, weight: 3 },
  { id: "akkalkuwa", name: "Akkalkuwa", local: "अक्कलकुवा", district: "Nandurbar", lat: 21.75, lng: 74.05, weight: 2 },
  { id: "dhadgaon", name: "Dhadgaon", local: "धडगाव", district: "Nandurbar", lat: 21.85, lng: 74.2, weight: 2 },
] as const;

export const CITY_BY_ID: ReadonlyMap<string, KhandeshCity> = new Map(
  KHANDESH_CITIES.map((c) => [c.id, c]),
);

export const CITY_IDS: readonly string[] = KHANDESH_CITIES.map((c) => c.id);

const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLng = (bLng - aLng) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function cityLabel(id: string | null | undefined): string {
  if (!id) return "Location not set";
  return CITY_BY_ID.get(id)?.name ?? id;
}
