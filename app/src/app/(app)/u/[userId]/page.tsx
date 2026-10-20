"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Photo } from "@/components/media";
import { MatchModal, Sheet } from "@/components/overlays";
import { api } from "@/lib/client/api";
import { distanceLabel, useToast } from "@/lib/client/hooks";
import type { Profile } from "@/lib/types";

const INTENT_LABEL: Record<string, string> = {
  longterm: "Something real",
  marriage: "Marriage",
  casual: "Casual dating",
  friends: "New friends",
};

interface DetailResponse {
  profile: Profile;
  relationship: {
    matched: boolean;
    matchId: string | null;
    likedMe: boolean;
    iLiked: boolean;
    blocked: boolean;
  };
}

export default function UserProfilePage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [match, setMatch] = useState<{ matchId: string } | null>(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    api
      .get<DetailResponse>(`/api/profile/${params.userId}`)
      .then(setData)
      .catch((err) => showToast(err instanceof Error ? err.message : "Could not load profile"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.userId]);

  const act = async (action: "like" | "pass" | "super") => {
    if (busy || !data) return;
    setBusy(true);
    try {
      const res = await api.post<{ matched: boolean; matchId?: string }>("/api/swipe", {
        targetId: data.profile.id,
        action,
      });
      if (res.matched && res.matchId) {
        setMatch({ matchId: res.matchId });
      } else if (action === "pass") {
        router.push("/discover");
      } else {
        showToast("Like sent");
        router.push("/discover");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    if (!data) return;
    try {
      await api.post("/api/block", { targetId: data.profile.id, block: true });
      router.push("/discover");
      showToast("Blocked");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not block");
    }
  };

  const report = async () => {
    if (!data) return;
    try {
      await api.post("/api/report", { targetId: data.profile.id, reason: "fake" });
      showToast("Reported — thanks, we'll review it");
      setMenuOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not report");
    }
  };

  const profile = data?.profile;

  return (
    <>
      <header className="profile-head">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back">
          <Icon name="back" size={20} />
        </button>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div className="profile-title" style={{ justifyContent: "center", fontSize: 22 }}>
            {profile ? `${profile.name.split(" ")[0]}, ${profile.age}` : "…"}
            {profile?.photoVerified && (
              <span style={{ color: "#6ea8ff", display: "flex" }}>
                <Icon name="verified" size={17} />
              </span>
            )}
          </div>
          <div className="profile-sub" style={{ justifyContent: "center" }}>
            <Icon name="pin" size={11} />
            {profile ? profile.cityName : ""}
          </div>
        </div>
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Options">
          <Icon name="sliders" size={18} />
        </button>
      </header>

      {!profile ? (
        <div className="profile-photo skeleton" />
      ) : (
        <>
          <div className="profile-photo">
            <Photo
              src={profile.photos[0]}
              seed={profile.id}
              name={profile.name}
              alt={`${profile.name}, ${profile.age}`}
            />
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {data.relationship.likedMe && (
                <span className="match-pill" style={{ background: "rgba(255,90,43,0.85)" }}>
                  <span className="dot" style={{ background: "#fff" }} />
                  Likes you
                </span>
              )}
              {profile.distanceKm !== null && (
                <span className="match-pill">{distanceLabel(profile.distanceKm)}</span>
              )}
            </div>
          </div>

          <div className="section">
            <div className="section-label">About</div>
            <p className="bio">{profile.bio || "No bio yet."}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {profile.job && <span className="interest-pill">{profile.job}</span>}
              {profile.heightCm && <span className="interest-pill">{profile.heightCm} cm</span>}
              {profile.intent && (
                <span className="interest-pill">
                  {INTENT_LABEL[profile.intent] ?? profile.intent}
                </span>
              )}
            </div>
          </div>

          <div className="section">
            <div className="section-label">Interests</div>
            <div className="interest-grid">
              {profile.interests.map((tag) => (
                <span key={tag} className="interest-pill">
                  <span className="interest-dot" />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {profile.prompts.length > 0 && (
            <div className="section">
              <div className="section-label">Prompts</div>
              {profile.prompts.map((prompt) => (
                <div key={prompt.question} className="prompt-card">
                  <div className="prompt-q">{prompt.question}</div>
                  <div className="prompt-a">{prompt.answer}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ height: 104 }} />
        </>
      )}

      {data && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: "var(--shell-width)",
            padding: "14px 18px calc(14px + env(safe-area-inset-bottom, 0px))",
            background: "linear-gradient(to top, rgba(10,10,11,0.98) 40%, transparent)",
            display: "flex",
            gap: 12,
            zIndex: 30,
          }}
        >
          {data.relationship.matched && data.relationship.matchId ? (
            <button
              className="btn btn-primary btn-block"
              onClick={() => router.push(`/chat/${data.relationship.matchId}`)}
            >
              <Icon name="message" size={18} />
              Message
            </button>
          ) : (
            <>
              <button
                className="action action-pass"
                style={{ width: 54, height: 54, flexShrink: 0 }}
                onClick={() => void act("pass")}
                disabled={busy}
                aria-label="Pass"
              >
                <Icon name="close" size={24} />
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => void act("like")}
                disabled={busy}
              >
                <Icon name="heart-filled" size={19} />
                Like
              </button>
              <button
                className="action action-super"
                style={{ width: 54, height: 54, flexShrink: 0 }}
                onClick={() => void act("super")}
                disabled={busy}
                aria-label="Super like"
              >
                <Icon name="star-filled" size={20} />
              </button>
            </>
          )}
        </div>
      )}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Profile options">
        <button className="list-row" style={{ width: "100%", borderRadius: 14 }} onClick={() => void report()}>
          <span className="row-icon">
            <Icon name="flag" size={17} />
          </span>
          <span style={{ flex: 1, textAlign: "left", fontWeight: 600, fontSize: 14.5 }}>
            Report profile
          </span>
        </button>
        <button
          className="list-row"
          style={{ width: "100%", borderRadius: 14, color: "var(--danger)" }}
          onClick={() => void block()}
        >
          <span className="row-icon" style={{ color: "var(--danger)" }}>
            <Icon name="block" size={17} />
          </span>
          <span style={{ flex: 1, textAlign: "left", fontWeight: 600, fontSize: 14.5 }}>Block</span>
        </button>
      </Sheet>

      {match && data && (
        <MatchModal
          me={{ name: "You", photo: null }}
          other={{ name: data.profile.name, photo: data.profile.photos[0] ?? null }}
          onClose={() => setMatch(null)}
          onMessage={() => router.push(`/chat/${match.matchId}`)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
