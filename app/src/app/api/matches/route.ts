import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { loadProfiles } from "@/lib/profiles";
import type { MatchSummary } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireUser();
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT m.id,
              m.created_at,
              m.last_message_at,
              CASE WHEN m.user_a = ? THEN m.user_b ELSE m.user_a END AS other_id
         FROM matches m
        WHERE (m.user_a = ? OR m.user_b = ?)
          AND m.unmatched_at IS NULL
        ORDER BY COALESCE(m.last_message_at, m.created_at) DESC
        LIMIT 100`,
    )
    .all(user.id, user.id, user.id) as Array<{
    id: string;
    created_at: number;
    last_message_at: number | null;
    other_id: string;
  }>;

  if (rows.length === 0) return json({ matches: [] });

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");

  const lastMessages = db
    .prepare(
      `SELECT m.match_id, m.body, m.sender_id, m.created_at
         FROM messages m
         JOIN (SELECT match_id, MAX(id) AS max_id FROM messages
                WHERE match_id IN (${placeholders}) GROUP BY match_id) latest
           ON latest.max_id = m.id`,
    )
    .all(...ids) as Array<{ match_id: string; body: string; sender_id: string; created_at: number }>;

  const unread = db
    .prepare(
      `SELECT match_id, COUNT(*) AS n FROM messages
        WHERE match_id IN (${placeholders}) AND sender_id <> ? AND read_at IS NULL
        GROUP BY match_id`,
    )
    .all(...ids, user.id) as Array<{ match_id: string; n: number }>;

  const lastByMatch = new Map(lastMessages.map((m) => [m.match_id, m]));
  const unreadByMatch = new Map(unread.map((u) => [u.match_id, Number(u.n)]));

  const profiles = loadProfiles(
    rows.map((r) => r.other_id),
    { lat: Number(user.lat), lng: Number(user.lng) },
    db,
  );

  const matches: MatchSummary[] = [];
  for (const row of rows) {
    const other = profiles.get(row.other_id);
    if (!other) continue;
    const last = lastByMatch.get(row.id);
    matches.push({
      id: row.id,
      other,
      matchedAt: row.created_at,
      lastMessageAt: row.last_message_at,
      lastMessage: last ? { body: last.body, mine: last.sender_id === user.id } : null,
      unreadCount: unreadByMatch.get(row.id) ?? 0,
      isNew: !last,
    });
  }

  return json({ matches });
});
