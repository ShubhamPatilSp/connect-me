"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Photo } from "@/components/media";
import { api } from "@/lib/client/api";
import { relativeTime, useRealtime, useToast } from "@/lib/client/hooks";
import type { MatchSummary } from "@/lib/types";

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, showToast] = useToast();
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ matches: MatchSummary[] }>("/api/matches");
      setMatches(res.matches);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not load matches");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => void load(), 400);
  }, [load]);

  useRealtime((event) => {
    if (event.type === "match" || event.type === "message") scheduleReload();
  });

  const fresh = matches.filter((m) => m.isNew);
  const conversations = matches.filter((m) => !m.isNew);

  return (
    <>
      <header className="topbar">
        <div className="topbar-text">
          <div className="greeting">Matches</div>
          <div className="greeting-sub">
            <Icon name="heart" size={11} />
            {matches.length === 0
              ? "No matches yet"
              : `${matches.length} ${matches.length === 1 ? "match" : "matches"}`}
          </div>
        </div>
        <Link href="/discover" className="icon-btn" aria-label="Discover">
          <Icon name="home" size={19} />
        </Link>
      </header>

      {loading ? (
        <div style={{ padding: "0 18px", display: "grid", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 76 }} />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="mail" size={26} />
          </div>
          <h2 className="h2">No matches yet</h2>
          <p className="muted" style={{ maxWidth: 280, fontSize: 14 }}>
            A match happens when you both swipe right. Keep going — your first one is close.
          </p>
          <Link href="/discover" className="btn btn-primary btn-sm">
            Start swiping
          </Link>
        </div>
      ) : (
        <>
          {fresh.length > 0 && (
            <>
              <div className="section-title" style={{ padding: "0 18px" }}>
                <span className="eyebrow">New matches</span>
                <span className="dim" style={{ fontSize: 12 }}>
                  Say hi first
                </span>
              </div>
              <div className="new-row">
                {fresh.map((m) => (
                  <Link key={m.id} href={`/chat/${m.id}`} className="new-match">
                    <span className="new-match-avatar">
                      <Photo
                        src={m.other.photos[0]}
                        seed={m.other.id}
                        name={m.other.name}
                        variant="avatar"
                        alt=""
                      />
                    </span>
                    <span className="new-match-name">{m.other.name.split(" ")[0]}</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {conversations.length > 0 && (
            <div className="section-title" style={{ padding: "0 18px" }}>
              <span className="eyebrow">Messages</span>
            </div>
          )}

          <div>
            {conversations.map((m) => (
              <Link key={m.id} href={`/chat/${m.id}`} className="match-row">
                <span className="match-avatar">
                  <Photo
                    src={m.other.photos[0]}
                    seed={m.other.id}
                    name={m.other.name}
                    alt=""
                  />
                </span>
                <span className="match-body">
                  <span className="match-name">
                    {m.other.name}
                    {m.other.photoVerified && (
                      <span style={{ color: "#6ea8ff", display: "flex" }}>
                        <Icon name="verified" size={14} />
                      </span>
                    )}
                  </span>
                  <span className="match-preview" data-new={m.unreadCount > 0}>
                    {m.lastMessage
                      ? `${m.lastMessage.mine ? "You: " : ""}${m.lastMessage.body}`
                      : "New match — say something"}
                  </span>
                </span>
                <span className="match-meta">
                  <span className="match-time">
                    {relativeTime(m.lastMessageAt ?? m.matchedAt)}
                  </span>
                  {m.unreadCount > 0 && <span className="unread-dot">{m.unreadCount}</span>}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
