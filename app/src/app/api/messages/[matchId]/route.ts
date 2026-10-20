import { getDb, now } from "@/lib/db";
import { badRequest, handler, json, notFound, readJson, requireString, tooMany } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { publish } from "@/lib/bus";
import { loadProfiles } from "@/lib/profiles";
import { take } from "@/lib/ratelimit";
import type { Message } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MatchRow {
  id: string;
  user_a: string;
  user_b: string;
  unmatched_at: number | null;
}

function membership(matchId: string, userId: string): MatchRow {
  const match = getDb()
    .prepare("SELECT id, user_a, user_b, unmatched_at FROM matches WHERE id = ?")
    .get(matchId) as MatchRow | undefined;
  if (!match || (match.user_a !== userId && match.user_b !== userId)) {
    throw notFound("That conversation doesn't exist");
  }
  if (match.unmatched_at) throw notFound("This conversation has ended");
  return match;
}

const shape = (row: {
  id: number | bigint;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: number;
  read_at: number | null;
}, me: string): Message => ({
  id: Number(row.id),
  matchId: row.match_id,
  senderId: row.sender_id,
  body: row.body,
  createdAt: Number(row.created_at),
  readAt: row.read_at === null ? null : Number(row.read_at),
  mine: row.sender_id === me,
});

export const GET = handler(
  async (req: Request, ctx: { params: Promise<{ matchId: string }> }) => {
    const user = await requireUser();
    const { matchId } = await ctx.params;
    const match = membership(matchId, user.id);

    const url = new URL(req.url);
    const after = Number(url.searchParams.get("after") ?? 0) || 0;
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT id, match_id, sender_id, body, created_at, read_at
           FROM messages WHERE match_id = ? AND id > ? ORDER BY id ASC LIMIT 200`,
      )
      .all(matchId, after) as Array<{
      id: number;
      match_id: string;
      sender_id: string;
      body: string;
      created_at: number;
      read_at: number | null;
    }>;

    // Opening the thread marks the other side's messages as read.
    const readAt = now();
    db.prepare(
      "UPDATE messages SET read_at = ? WHERE match_id = ? AND sender_id <> ? AND read_at IS NULL",
    ).run(readAt, matchId, user.id);

    const otherId = match.user_a === user.id ? match.user_b : match.user_a;
    const other = loadProfiles([otherId], { lat: Number(user.lat), lng: Number(user.lng) }, db).get(otherId);

    return json({
      messages: rows.map((row) => shape(row, user.id)),
      other,
      readAt,
    });
  },
);

export const POST = handler(
  async (req: Request, ctx: { params: Promise<{ matchId: string }> }) => {
    const user = await requireUser();
    const { matchId } = await ctx.params;
    const match = membership(matchId, user.id);

    if (!take(`msg:${user.id}`, 20, 2)) {
      throw tooMany("Slow down a little — too many messages at once");
    }

    const body = await readJson(req);
    const text = requireString(body, "body", { min: 1, max: 1000 });
    const db = getDb();
    const t = now();

    const result = db
      .prepare(
        "INSERT INTO messages (match_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(matchId, user.id, text, t);

    db.prepare("UPDATE matches SET last_message_at = ? WHERE id = ?").run(t, matchId);
    db.prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(t, user.id);

    const messageId = Number(result.lastInsertRowid);
    const otherId = match.user_a === user.id ? match.user_b : match.user_a;

    publish(otherId, {
      type: "message",
      matchId,
      messageId,
      senderId: user.id,
      body: text,
      createdAt: t,
    });

    return json({
      message: {
        id: messageId,
        matchId,
        senderId: user.id,
        body: text,
        createdAt: t,
        readAt: null,
        mine: true,
      } satisfies Message,
    });
  },
);
