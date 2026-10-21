/**
 * Deterministic seed data.
 *
 * Seeds local development with deterministic sample profiles. Production
 * deployments should use real signups instead of generated accounts.
 */

import type { Database } from "./db";
import { CITY_BY_ID } from "./geo";

const DAY = 86_400;
const now = (): number => Math.floor(Date.now() / 1000);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLUSTERS: Record<string, string[]> = {
  foodie: ["Street Food", "Bhakri & Pithla", "Chai", "Cooking", "Marathi Cinema"],
  outdoors: ["Trekking", "Forts", "Bike Rides", "Monsoon", "Photography"],
  arts: ["Digital Art", "Poetry", "Books", "Music", "Marathi Cinema"],
  homebody: ["Books", "Cooking", "Gaming", "Chai", "Music"],
  fitness: ["Gym", "Cricket", "Trekking", "Bike Rides", "Street Food"],
  social: ["Volunteering", "Travel", "Street Food", "Music", "Photography"],
};
const EXTRA_INTERESTS = [
  "Ahirani Songs",
  "Sugarcane Fields",
  "Temple Runs",
  "Farm Life",
  "Stand-up Comedy",
  "Badminton",
  "Sketching",
  "Late-night Drives",
];

const PROMPTS = [
  "A perfect Khandesh weekend for me is…",
  "The way to my heart is…",
  "My most controversial food opinion…",
  "You should message me if…",
  "My love language is…",
  "The best thing about growing up here…",
];

interface SeedPerson {
  name: string;
  gender: "woman" | "man";
  age: number;
  cityId: string;
  job: string;
  height: number;
  intent: "longterm" | "marriage" | "casual" | "friends";
  cluster: keyof typeof CLUSTERS;
  bio: string;
  promptAnswer: string;
  verified: boolean;
  photo: number;
  photo2?: number;
}

const WOMEN: SeedPerson[] = [
  { name: "Sneha Patil", gender: "woman", age: 25, cityId: "jalgaon", job: "Fashion Designer", height: 163, intent: "longterm", cluster: "arts", bio: "Designing clothes by day, sketching forts by evening. Jalgaon born, Khandesh obsessed.", promptAnswer: "Chai at a tapri in Bhusawal, then a long drive with no destination.", verified: true, photo: 1 },
  { name: "Priya Chaudhari", gender: "woman", age: 24, cityId: "dhule", job: "Pharmacist", height: 158, intent: "marriage", cluster: "homebody", bio: "Dhule girl who will absolutely judge your book collection. Family first, always.", promptAnswer: "Someone who texts back in the same century.", verified: true, photo: 2 },
  { name: "Rutuja Deshmukh", gender: "woman", age: 27, cityId: "bhusawal", job: "Software Engineer", height: 165, intent: "longterm", cluster: "fitness", bio: "Gym at 6, standups at 10, banana chips at 5. Balance is a myth I'm working on.", promptAnswer: "A gym partner who doesn't skip leg day.", verified: false, photo: 3 },
  { name: "Aarti Bhole", gender: "woman", age: 23, cityId: "amalner", job: "B.Ed Student", height: 160, intent: "longterm", cluster: "arts", bio: "Teaching is the plan, poetry is the habit. Amalner's monsoon is my favourite season.", promptAnswer: "Read me one poem and I'm yours.", verified: false, photo: 4 },
  { name: "Pooja Wani", gender: "woman", age: 26, cityId: "chopda", job: "Bank Officer", height: 162, intent: "marriage", cluster: "social", bio: "Numbers at work, people everywhere else. I organise everyone's birthdays.", promptAnswer: "Show up on time. That's the whole bar.", verified: true, photo: 5 },
  { name: "Shraddha Sonawane", gender: "woman", age: 28, cityId: "jalgaon", job: "Interior Designer", height: 168, intent: "longterm", cluster: "arts", bio: "I make rooms feel like homes. Still working on making my own feel finished.", promptAnswer: "Good taste in curtains and in people.", verified: true, photo: 6 },
  { name: "Vaishnavi Patil", gender: "woman", age: 22, cityId: "shirpur", job: "B.Sc Agriculture", height: 157, intent: "friends", cluster: "outdoors", bio: "Grew up between sugarcane fields and fort trails. Shirpur sunsets are underrated.", promptAnswer: "Take me somewhere with no network for a day.", verified: false, photo: 7 },
  { name: "Manasi Borse", gender: "woman", age: 29, cityId: "dhule", job: "Doctor (MBBS)", height: 166, intent: "marriage", cluster: "fitness", bio: "Night shifts, morning runs, zero patience for small talk. Ask me something real.", promptAnswer: "Curiosity. Genuine, nosy, endless curiosity.", verified: true, photo: 8 },
  { name: "Nikita Tadvi", gender: "woman", age: 24, cityId: "nandurbar", job: "Teacher", height: 159, intent: "longterm", cluster: "social", bio: "Nandurbar to the world. I teach kids who ask better questions than most adults.", promptAnswer: "Someone kind to people who can't do anything for them.", verified: false, photo: 9 },
  { name: "Ketaki Mahajan", gender: "woman", age: 26, cityId: "pachora", job: "Content Creator", height: 164, intent: "casual", cluster: "arts", bio: "I film Pachora's food stalls for a living. Yes, I'll take you to the good ones.", promptAnswer: "Let me order for you once. Just once.", verified: false, photo: 10 },
  { name: "Anjali Vasave", gender: "woman", age: 25, cityId: "shahada", job: "Nurse", height: 161, intent: "marriage", cluster: "homebody", bio: "Shahada girl, quiet on the outside, chaotic group chat on the inside.", promptAnswer: "Long voice notes. I listen to all of them.", verified: true, photo: 11 },
  { name: "Rutuja Koli", gender: "woman", age: 27, cityId: "chalisgaon", job: "CA Finalist", height: 160, intent: "longterm", cluster: "fitness", bio: "Studying since 2019, still smiling. Chalisgaon's most disciplined procrastinator.", promptAnswer: "Ambition that doesn't need to be loud.", verified: false, photo: 12 },
  { name: "Tanvi Shirsath", gender: "woman", age: 23, cityId: "jalgaon", job: "Graphic Designer", height: 155, intent: "casual", cluster: "arts", bio: "I design for a living and overthink for free. Bring snacks.", promptAnswer: "A playlist that isn't just Bollywood remixes.", verified: true, photo: 13 },
  { name: "Sakshi Pawar", gender: "woman", age: 28, cityId: "jamner", job: "Librarian", height: 167, intent: "longterm", cluster: "homebody", bio: "I have read 400 books and remember 40. Ask me about the 40.", promptAnswer: "Recommend me a book I haven't heard of.", verified: false, photo: 14 },
  { name: "Dhanashri Ahire", gender: "woman", age: 24, cityId: "dondaicha", job: "Lab Technician", height: 158, intent: "marriage", cluster: "foodie", bio: "Dondaicha's biggest foodie. My mother's pithla has ruined restaurants for me.", promptAnswer: "Feed me and don't comment on the quantity.", verified: true, photo: 15 },
  { name: "Isha Bhamre", gender: "woman", age: 26, cityId: "dhule", job: "HR Executive", height: 163, intent: "longterm", cluster: "social", bio: "I interview people all day. Now I'd like to be the one asked questions.", promptAnswer: "One good question beats ten compliments.", verified: true, photo: 16 },
  { name: "Meera Chaudhari", gender: "woman", age: 30, cityId: "jalgaon", job: "Entrepreneur", height: 169, intent: "marriage", cluster: "fitness", bio: "Run a small packaging business in Jalgaon. Built it myself, proud of it.", promptAnswer: "Someone with their own thing going on.", verified: true, photo: 17 },
  { name: "Gauri Nikam", gender: "woman", age: 22, cityId: "sakri", job: "Student", height: 156, intent: "friends", cluster: "outdoors", bio: "Sakri side, hills everywhere. I'll out-walk you and then complain about it.", promptAnswer: "A trek that starts before sunrise.", verified: false, photo: 18 },
];

const MEN: SeedPerson[] = [
  { name: "Sanket Chaudhari", gender: "man", age: 27, cityId: "jalgaon", job: "Civil Engineer", height: 175, intent: "longterm", cluster: "outdoors", bio: "I build roads for a living and drive them for fun. Jalgaon to Chopda is my reset button.", promptAnswer: "A full tank and an empty Sunday.", verified: true, photo: 1 },
  { name: "Omkar Deshmukh", gender: "man", age: 26, cityId: "dhule", job: "Data Analyst", height: 172, intent: "longterm", cluster: "homebody", bio: "Spreadsheets by day, chess by night. Dhule's most boring interesting person.", promptAnswer: "Beat me at chess and I'll cook for you.", verified: true, photo: 2 },
  { name: "Pratik Wani", gender: "man", age: 29, cityId: "bhusawal", job: "Railway Officer", height: 178, intent: "marriage", cluster: "fitness", bio: "Bhusawal junction runs on time and so do I. Family, gym, cricket, repeat.", promptAnswer: "Someone who laughs at their own jokes.", verified: false, photo: 3 },
  { name: "Akshay Bhole", gender: "man", age: 25, cityId: "amalner", job: "Photographer", height: 174, intent: "casual", cluster: "arts", bio: "I shoot weddings for money and forts for peace. Amalner's light at 6pm is unreal.", promptAnswer: "Let me take your photo. You'll like it, I promise.", verified: true, photo: 4 },
  { name: "Nikhil Sonawane", gender: "man", age: 28, cityId: "nandurbar", job: "Forest Range Officer", height: 180, intent: "marriage", cluster: "outdoors", bio: "I spend my days in Nandurbar's forests. Yes, I know every trail worth knowing.", promptAnswer: "Come see a sunrise I haven't shown anyone.", verified: true, photo: 5 },
  { name: "Swapnil Mahajan", gender: "man", age: 24, cityId: "chopda", job: "MBA Student", height: 171, intent: "friends", cluster: "social", bio: "Chopda boy, Pune hostel, back home every weekend. I know every good misal place.", promptAnswer: "Debate me about anything. I'll lose gracefully.", verified: false, photo: 6 },
  { name: "Tejas Borse", gender: "man", age: 30, cityId: "jalgaon", job: "Doctor (MD)", height: 176, intent: "marriage", cluster: "homebody", bio: "Physician. I'll ask about your sleep schedule before your hobbies. Sorry in advance.", promptAnswer: "Someone who values quiet evenings.", verified: true, photo: 7 },
  { name: "Yash Tadvi", gender: "man", age: 23, cityId: "shahada", job: "Software Tester", height: 173, intent: "longterm", cluster: "arts", bio: "I find bugs for a living and poetry for fun. Shahada's quiet is underrated.", promptAnswer: "Send me a song and I'll send one back.", verified: false, photo: 8 },
  { name: "Abhijit Vasave", gender: "man", age: 26, cityId: "taloda", job: "Agriculture Officer", height: 177, intent: "marriage", cluster: "outdoors", bio: "Taloda, farms, and a bike that's seen every road in Nandurbar district.", promptAnswer: "Someone who doesn't mind mud on their shoes.", verified: true, photo: 9 },
  { name: "Ganesh Koli", gender: "man", age: 28, cityId: "chalisgaon", job: "Shop Owner", height: 174, intent: "marriage", cluster: "foodie", bio: "Third generation in the family business. I close the shop early on Sundays.", promptAnswer: "Come taste the chivda. Then decide.", verified: false, photo: 10 },
  { name: "Suraj Shirsath", gender: "man", age: 25, cityId: "pachora", job: "Teacher", height: 172, intent: "longterm", cluster: "social", bio: "History teacher. I will tell you about Pachora's old buildings whether you ask or not.", promptAnswer: "Patience with my tangents.", verified: true, photo: 11 },
  { name: "Mahesh Pawar", gender: "man", age: 31, cityId: "dhule", job: "Bank Manager", height: 175, intent: "marriage", cluster: "fitness", bio: "Stable job, stable head, terrible at texting. Call me instead.", promptAnswer: "Directness. Say what you mean.", verified: true, photo: 12 },
  { name: "Vicky Ahire", gender: "man", age: 24, cityId: "dondaicha", job: "Graphic Designer", height: 170, intent: "casual", cluster: "arts", bio: "I make posters for local events and playlists nobody asked for.", promptAnswer: "Send me your worst meme. I'll rate it honestly.", verified: false, photo: 13 },
  { name: "Pravin More", gender: "man", age: 27, cityId: "shirpur", job: "Sugar Factory Supervisor", height: 179, intent: "marriage", cluster: "foodie", bio: "Shirpur, sugar season, and the best kanda bhaji in the district. Fight me.", promptAnswer: "Someone who eats without checking the price first.", verified: false, photo: 14 },
  { name: "Rohit Patil", gender: "man", age: 26, cityId: "jalgaon", job: "Chartered Accountant", height: 176, intent: "longterm", cluster: "homebody", bio: "I do other people's taxes and my own laundry. Balanced life.", promptAnswer: "A quiet dinner over a loud party.", verified: true, photo: 15 },
  { name: "Sameer Tadvi", gender: "man", age: 29, cityId: "navapur", job: "Railway Technician", height: 174, intent: "marriage", cluster: "fitness", bio: "Navapur border side. Early shifts, long walks, zero drama.", promptAnswer: "Consistency. Show up again tomorrow.", verified: false, photo: 16 },
  { name: "Aniket Joshi", gender: "man", age: 25, cityId: "yawal", job: "Journalist", height: 173, intent: "casual", cluster: "arts", bio: "I write about Khandesh for a living. Everyone here has a story, including you.", promptAnswer: "Tell me something nobody here knows about you.", verified: true, photo: 17 },
  { name: "Vishal Bhole", gender: "man", age: 32, cityId: "amalner", job: "Factory Owner", height: 178, intent: "marriage", cluster: "social", bio: "Amalner's looms, my family's trade. Looking for something real, not a timepass.", promptAnswer: "Honesty about what you actually want.", verified: true, photo: 18 },
];

/** Stable placeholder portraits. The client falls back to generated art if these fail. */
const photoUrl = (gender: "woman" | "man", n: number): string =>
  `/seed/${gender === "woman" ? "w" : "m"}${String(n).padStart(2, "0")}.jpg`;

export function seedIfEmpty(db: Database): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (Number(count.n) > 0) return;

  const rand = mulberry32(20261020);
  const t = now();

  const insertUser = db.prepare(`
    INSERT INTO users (id, phone, name, birthdate, gender, seeking, city_id, lat, lng,
                       bio, job, height_cm, intent, photo_verified, is_premium,
                       shadow_banned, onboarding_complete, last_active_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
  `);
  const insertPhoto = db.prepare(
    "INSERT INTO photos (user_id, url, position, moderation) VALUES (?, ?, ?, 'approved')",
  );
  const insertInterest = db.prepare(
    "INSERT OR IGNORE INTO user_interests (user_id, tag) VALUES (?, ?)",
  );
  const insertPrompt = db.prepare(
    "INSERT INTO prompts (user_id, question, answer, position) VALUES (?, ?, ?, ?)",
  );

  const birthdateFor = (age: number): string => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - age);
    d.setMonth((d.getMonth() + 3) % 12);
    return d.toISOString().slice(0, 10);
  };

  const idFor = (i: number): string => `u_${String(i + 1).padStart(3, "0")}`;

  db.exec("BEGIN");
  try {
    // ── Seeded population ─────────────────────────────────────────────────
    const people = [...WOMEN, ...MEN];
    people.forEach((p, i) => {
      const id = idFor(i);
      const city = CITY_BY_ID.get(p.cityId) ?? CITY_BY_ID.get("jalgaon")!;
      const jitterLat = city.lat + (rand() - 0.5) * 0.06;
      const jitterLng = city.lng + (rand() - 0.5) * 0.06;
      const lastActive = t - Math.floor(rand() * 6 * DAY) - 300;

      insertUser.run(
        id, `+9190000001${String(i).padStart(2, "0")}`, p.name, birthdateFor(p.age),
        p.gender, p.gender === "woman" ? "men" : "women",
        city.id, jitterLat, jitterLng, p.bio, p.job, p.height, p.intent,
        p.verified ? 1 : 0, rand() > 0.85 ? 1 : 0, lastActive, lastActive - 40 * DAY,
      );

      insertPhoto.run(id, photoUrl(p.gender, p.photo), 0);
      if (p.photo2) insertPhoto.run(id, photoUrl(p.gender, p.photo2), 1);

      const base = CLUSTERS[p.cluster];
      for (const tag of base) insertInterest.run(id, tag);
      const extraCount = 1 + Math.floor(rand() * 2);
      for (let k = 0; k < extraCount; k++) {
        insertInterest.run(id, EXTRA_INTERESTS[Math.floor(rand() * EXTRA_INTERESTS.length)]);
      }

      insertPrompt.run(id, PROMPTS[i % PROMPTS.length], p.promptAnswer, 0);
    });

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
