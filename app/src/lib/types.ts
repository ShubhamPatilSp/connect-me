/** Shared domain types — imported by both server routes and client components. */

export type Gender = "woman" | "man" | "nonbinary";
export type Seeking = "women" | "men" | "everyone";
export type SwipeAction = "pass" | "like" | "super";
export type Intent = "longterm" | "marriage" | "casual" | "friends";

export interface Prompt {
  question: string;
  answer: string;
}

export interface Profile {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  seeking: Seeking;
  cityId: string;
  cityName: string;
  district: string;
  /** Only present when the viewer's coordinates are known. */
  distanceKm: number | null;
  bio: string;
  job: string | null;
  heightCm: number | null;
  intent: Intent | null;
  photoVerified: boolean;
  isPremium: boolean;
  photos: string[];
  interests: string[];
  prompts: Prompt[];
  lastActiveAt: number;
}

export interface DeckCard extends Profile {
  score: number;
  /** Human-readable explanation of why this person surfaced. */
  reasons: string[];
  /** True when this person has already liked the viewer. */
  likesYou: boolean;
}

export interface Message {
  id: number;
  matchId: string;
  senderId: string;
  body: string;
  createdAt: number;
  readAt: number | null;
  mine: boolean;
}

export interface MatchSummary {
  id: string;
  other: Profile;
  matchedAt: number;
  lastMessageAt: number | null;
  lastMessage: { body: string; mine: boolean } | null;
  unreadCount: number;
  /** True when neither side has sent a message yet. */
  isNew: boolean;
}

export interface SessionUser {
  id: string;
  name: string;
  phone: string;
  cityId: string;
  cityName: string;
  onboardingComplete: boolean;
  isPremium: boolean;
  photoVerified: boolean;
}

export interface ApiError {
  error: string;
  message: string;
}
