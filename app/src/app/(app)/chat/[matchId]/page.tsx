"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Photo } from "@/components/media";
import { Sheet } from "@/components/overlays";
import { api } from "@/lib/client/api";
import { clockTime, relativeTime, useRealtime, useToast } from "@/lib/client/hooks";
import type { Message, Profile } from "@/lib/types";

interface ThreadResponse {
  messages: Message[];
  other: Profile | null;
  readAt: number;
}

export default function ChatPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<Profile | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, showToast] = useToast();

  const bodyRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  const scrollToBottom = useCallback((smooth = true) => {
    const node = bodyRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ThreadResponse>(`/api/messages/${matchId}`);
      setMessages(res.messages);
      setOther(res.other);
      lastId.current = res.messages.at(-1)?.id ?? 0;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not open this chat");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [matchId, showToast, scrollToBottom]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime((event) => {
    if (event.type !== "message" || event.matchId !== matchId) return;
    const incoming = event as unknown as {
      messageId: number;
      senderId: string;
      body: string;
      createdAt: number;
    };
    if (incoming.messageId <= lastId.current) return;
    lastId.current = incoming.messageId;
    setMessages((prev) => [
      ...prev,
      {
        id: incoming.messageId,
        matchId,
        senderId: incoming.senderId,
        body: incoming.body,
        createdAt: incoming.createdAt,
        readAt: null,
        mine: false,
      },
    ]);
    requestAnimationFrame(() => scrollToBottom(true));
  });

  useEffect(() => {
    if (messages.length > 0) requestAnimationFrame(() => scrollToBottom(true));
  }, [messages.length, scrollToBottom]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    const tempId = -Date.now();
    const optimistic: Message = {
      id: tempId,
      matchId,
      senderId: "me",
      body: text,
      createdAt: Math.floor(Date.now() / 1000),
      readAt: null,
      mine: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);

    try {
      const res = await api.post<{ message: Message }>(`/api/messages/${matchId}`, { body: text });
      lastId.current = Math.max(lastId.current, res.message.id);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? res.message : m)));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      showToast(err instanceof Error ? err.message : "Message didn't send");
    } finally {
      setSending(false);
    }
  };

  const unmatch = async () => {
    try {
      await api.post(`/api/matches/${matchId}/unmatch`);
      router.push("/matches");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not unmatch");
    }
  };

  const report = async () => {
    if (!other) return;
    try {
      await api.post("/api/report", { targetId: other.id, reason: "harassment" });
      await api.post(`/api/matches/${matchId}/unmatch`);
      router.push("/matches");
      showToast("Reported and removed");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not report");
    }
  };

  return (
    <>
      <div className="chat">
        <header className="chat-head">
          <button className="icon-btn" onClick={() => router.push("/matches")} aria-label="Back">
            <Icon name="back" size={20} />
          </button>
          <span className="match-avatar" style={{ width: 42, height: 42 }}>
            <Photo
              src={other?.photos[0]}
              seed={other?.id ?? matchId}
              name={other?.name ?? "Match"}
              alt=""
            />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 650, letterSpacing: "-0.01em" }}>
              {other?.name ?? "Loading…"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
              {other
                ? `${other.cityName}${other.distanceKm !== null ? ` · ${Math.round(other.distanceKm)} km` : ""}`
                : ""}
            </div>
          </div>
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Options">
            <Icon name="sliders" size={18} />
          </button>
        </header>

        <div className="chat-body" ref={bodyRef}>
          <div
            style={{
              textAlign: "center",
              fontSize: 11.5,
              color: "var(--text-dim)",
              padding: "4px 0 14px",
            }}
          >
            You matched{other ? ` with ${other.name.split(" ")[0]}` : ""} — be kind, be real.
          </div>

          {loading && (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="skeleton" style={{ height: 42, width: "60%" }} />
              <div className="skeleton" style={{ height: 42, width: "48%", marginLeft: "auto" }} />
            </div>
          )}

          {!loading && messages.length === 0 && other && (
            <div style={{ padding: "18px 4px" }}>
              <p className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>
                Break the ice. Try one of these:
              </p>
              {[
                `Ask about ${other.interests[0] ?? "their weekend"}`,
                `You're both in ${other.cityName} — what's the best misal there?`,
                "What's your ideal Sunday in Khandesh?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  className="chip"
                  style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8, height: "auto", padding: "12px 16px", whiteSpace: "normal" }}
                  onClick={() => setDraft(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`bubble ${message.mine ? "bubble-me" : "bubble-them"}`}>
              {message.body}
              <div className="bubble-time">{clockTime(message.createdAt)}</div>
            </div>
          ))}
        </div>

        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            className="input"
            placeholder="Write something real…"
            value={draft}
            maxLength={1000}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
          />
          <button className="chat-send" type="submit" disabled={!draft.trim() || sending} aria-label="Send">
            <Icon name="send" size={20} />
          </button>
        </form>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Conversation options">
        <button
          className="list-row"
          style={{ width: "100%", borderRadius: 14, marginBottom: 8 }}
          onClick={() => {
            setMenuOpen(false);
            void report();
          }}
        >
          <span className="row-icon">
            <Icon name="flag" size={17} />
          </span>
          <span style={{ flex: 1, textAlign: "left" }}>
            <span style={{ display: "block", fontWeight: 600, fontSize: 14.5 }}>Report</span>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--text-dim)" }}>
              Sends to moderation and removes the match
            </span>
          </span>
        </button>
        <button
          className="list-row"
          style={{ width: "100%", borderRadius: 14, color: "var(--danger)" }}
          onClick={() => {
            setMenuOpen(false);
            void unmatch();
          }}
        >
          <span className="row-icon" style={{ color: "var(--danger)" }}>
            <Icon name="close" size={17} />
          </span>
          <span style={{ flex: 1, textAlign: "left", fontWeight: 600, fontSize: 14.5 }}>
            Unmatch
          </span>
        </button>
        {other && (
          <p className="dim" style={{ fontSize: 11.5, marginTop: 14, textAlign: "center" }}>
            Last active {relativeTime(other.lastActiveAt)} ago
          </p>
        )}
      </Sheet>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
