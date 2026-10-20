"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Photo } from "@/components/media";
import { api } from "@/lib/client/api";
import { useToast } from "@/lib/client/hooks";
import type { Profile } from "@/lib/types";

interface MeResponse {
  user: {
    id: string;
    name: string;
    phone: string;
    cityId: string;
    isPremium: boolean;
    photoVerified: boolean;
    intent: string | null;
  };
  profile: Profile;
  stats: { likesRemaining: number; likesUsed: number; matches: number };
}

const INTENT_LABEL: Record<string, string> = {
  longterm: "Something real",
  marriage: "Marriage",
  casual: "Casual dating",
  friends: "New friends",
};

export default function MePage() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    api
      .get<MeResponse>("/api/me")
      .then(setData)
      .catch((err) => showToast(err instanceof Error ? err.message : "Could not load profile"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profile = data?.profile;

  return (
    <>
      <header className="profile-head">
        <Link href="/settings" className="icon-btn" aria-label="Settings">
          <Icon name="settings" size={19} />
        </Link>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div className="profile-title" style={{ justifyContent: "center" }}>
            {profile ? `${profile.name.split(" ")[0]}, ${profile.age}` : "…"}
            {profile?.photoVerified && (
              <span style={{ color: "#6ea8ff", display: "flex" }}>
                <Icon name="verified" size={18} />
              </span>
            )}
          </div>
          <div className="profile-sub" style={{ justifyContent: "center" }}>
            <Icon name="pin" size={11} />
            {profile ? `${profile.cityName}, Khandesh` : ""}
          </div>
        </div>
        <Link href="/me/edit" className="icon-btn" aria-label="Edit profile">
          <Icon name="edit" size={18} />
        </Link>
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
          </div>

          <div className="stat-strip">
            <div className="stat">
              <div className="stat-value">{data?.stats.matches ?? 0}</div>
              <div className="stat-label">Matches</div>
            </div>
            <div className="stat">
              <div className="stat-value">{data?.user.isPremium ? "∞" : data?.stats.likesRemaining}</div>
              <div className="stat-label">Likes left</div>
            </div>
            <div className="stat">
              <div className="stat-value">{profile.interests.length}</div>
              <div className="stat-label">Interests</div>
            </div>
          </div>

          <div className="section">
            <div className="section-label">About</div>
            <p className="bio">{profile.bio || "No bio yet — tap edit and add one."}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {profile.job && <span className="interest-pill">{profile.job}</span>}
              {profile.heightCm && <span className="interest-pill">{profile.heightCm} cm</span>}
              {profile.intent && (
                <span className="interest-pill">{INTENT_LABEL[profile.intent] ?? profile.intent}</span>
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

          <div className="section" style={{ paddingBottom: 24 }}>
            <Link
              href="/settings"
              className="list-row"
              style={{ borderRadius: 16, border: "1px solid var(--line)" }}
            >
              <span className="row-icon">
                <Icon name="shield" size={17} />
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 14.5 }}>Safety & settings</span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--text-dim)" }}>
                  Verification, privacy, blocked accounts
                </span>
              </span>
              <span className="chev">
                <Icon name="chevron" size={17} />
              </span>
            </Link>
          </div>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
