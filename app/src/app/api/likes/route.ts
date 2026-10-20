import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { loadProfiles } from "@/lib/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * People who liked the viewer and are not yet matched.
 * Free members see a blurred teaser (name hidden, photo blurred); members see
 * the full profile and can like back directly from this screen.
 */
export const GET = handler(async () => {
  const user = await requireUser();
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT s.swiper_id AS id, s.action, s.created_at
         FROM swipes s
        WHERE s.target_id = ?
          AND s.action IN ('like','super')
          AND NOT EXISTS (
                SELECT 1 FROM matches m
                 WHERE m.unmatched_at IS NULL
                   AND ((m.user_a = ? AND m.user_b = s.swiper_id)
                     OR (m.user_b = ? AND m.user_a = s.swiper_id)))
          AND NOT EXISTS (
                SELECT 1 FROM blocks b
                 WHERE (b.blocker_id = ? AND b.blocked_id = s.swiper_id)
                    OR (b.blocker_id = s.swiper_id AND b.blocked_id = ?))
        ORDER BY s.created_at DESC
        LIMIT 60`,
    )
    .all(user.id, user.id, user.id, user.id, user.id) as Array<{
    id: string;
    action: string;
    created_at: number;
  }>;

  if (rows.length === 0) return json({ likes: [], locked: false, total: 0 });

  const profiles = loadProfiles(
    rows.map((r) => r.id),
    { lat: Number(user.lat), lng: Number(user.lng) },
    db,
  );

  const locked = !user.is_premium;
  const likes = rows
    .map((row) => {
      const profile = profiles.get(row.id);
      if (!profile) return null;
      if (locked) {
        return {
          id: profile.id,
          age: profile.age,
          cityName: profile.cityName,
          photo: profile.photos[0] ?? null,
          superLike: row.action === "super",
          likedAt: row.created_at,
          locked: true,
          name: null,
          distanceKm: null,
        };
      }
      return {
        id: profile.id,
        age: profile.age,
        cityName: profile.cityName,
        photo: profile.photos[0] ?? null,
        superLike: row.action === "super",
        likedAt: row.created_at,
        locked: false,
        name: profile.name,
        distanceKm: profile.distanceKm,
      };
    })
    .filter(Boolean);

  return json({ likes, locked, total: likes.length });
});
