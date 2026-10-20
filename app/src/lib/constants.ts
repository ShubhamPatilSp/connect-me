/** Shared product constants — safe to import from client components. */

export const INTEREST_TAGS = [
  "Street Food",
  "Bhakri & Pithla",
  "Chai",
  "Cooking",
  "Marathi Cinema",
  "Trekking",
  "Forts",
  "Bike Rides",
  "Monsoon",
  "Photography",
  "Digital Art",
  "Poetry",
  "Books",
  "Music",
  "Gaming",
  "Gym",
  "Cricket",
  "Volunteering",
  "Travel",
  "Ahirani Songs",
  "Sugarcane Fields",
  "Temple Runs",
  "Farm Life",
  "Stand-up Comedy",
  "Badminton",
  "Sketching",
  "Late-night Drives",
] as const;

export const INTENTS = [
  { id: "longterm", label: "Something real", hint: "Long-term, no games" },
  { id: "marriage", label: "Marriage", hint: "Family knows I'm here" },
  { id: "casual", label: "Casual dating", hint: "See where it goes" },
  { id: "friends", label: "New friends", hint: "Expand my circle" },
] as const;

export const PROMPT_QUESTIONS = [
  "A perfect Khandesh weekend for me is…",
  "The way to my heart is…",
  "My most controversial food opinion…",
  "You should message me if…",
  "My love language is…",
  "The best thing about growing up here…",
] as const;

export const GENDERS = [
  { id: "woman", label: "Woman" },
  { id: "man", label: "Man" },
  { id: "nonbinary", label: "Non-binary" },
] as const;

export const SEEKING = [
  { id: "women", label: "Women" },
  { id: "men", label: "Men" },
  { id: "everyone", label: "Everyone" },
] as const;

export const REPORT_REASONS = [
  { id: "fake", label: "Fake profile" },
  { id: "harassment", label: "Harassment or abuse" },
  { id: "nudity", label: "Inappropriate photos" },
  { id: "underage", label: "Under 18" },
  { id: "scam", label: "Scam or asking for money" },
  { id: "other", label: "Something else" },
] as const;

export const BRAND = {
  name: "Connect Me",
  tagline: "Khandesh only. Real people, close by.",
  region: "Khandesh",
} as const;
