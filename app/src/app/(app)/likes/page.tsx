"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Photo } from "@/components/media";
import { api } from "@/lib/client/api";
import { useToast } from "@/lib/client/hooks";

interface LikeTile {
  id: string;
  age: number;
  cityName: string;
  photo: string | null;
  superLike: boolean;
  likedAt: number;
  locked: boolean;
  name: string | null;
  distanceKm: number | null;
}

interface LikesResponse {
  likes: LikeTile[];
  locked: boolean;
  total: number;
}

export default function LikesPage() {
  const [data, setData] = useState<LikesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, showToast] = useToast();

  const load = useCallback(async () => {
    try {
      const res = await api.get<LikesResponse>("/api/likes");
      setData(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not load likes");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const unlock = async () => {
    try {
      await api.post("/api/premium", { enable: true });
      await load();
      showToast("Connect Me Plus unlocked");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not unlock");
    }
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-text">
          <div className="greeting">Likes you</div>
          <div className="greeting-sub">
            <Icon name="heart" size={11} />
            {data ? `${data.total} people waiting on you` : "Loading…"}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="likes-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: "3 / 4" }} />
          ))}
        </div>
      ) : !data || data.total === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="heart" size={28} />
          </div>
          <h2 className="h2">No likes yet</h2>
          <p className="muted" style={{ maxWidth: 270, fontSize: 14 }}>
            Keep swiping. In Khandesh word travels fast — your profile will get seen.
          </p>
          <Link href="/discover" className="btn btn-ghost btn-sm">
            Back to discover
          </Link>
        </div>
      ) : (
        <>
          {data.locked && (
            <div
              style={{
                margin: "0 18px 16px",
                padding: 16,
                borderRadius: 18,
                background: "linear-gradient(135deg, rgba(255,90,43,0.16), rgba(124,92,255,0.12))",
                border: "1px solid rgba(255,90,43,0.3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icon name="lock" size={16} />
                <span style={{ fontWeight: 650, fontSize: 14.5 }}>
                  {data.total} {data.total === 1 ? "person likes" : "people like"} you
                </span>
              </div>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
                Plus shows you everyone who liked you, plus unlimited likes.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => void unlock()}>
                <Icon name="sparkle" size={15} />
                Unlock with Plus
              </button>
            </div>
          )}

          <div className="likes-grid">
            {data.likes.map((like) => (
              <Link
                key={like.id}
                href={like.locked ? "/likes" : `/u/${like.id}`}
                className="like-tile"
                data-locked={like.locked}
                onClick={(e) => {
                  if (like.locked) {
                    e.preventDefault();
                    void unlock();
                  }
                }}
              >
                <Photo
                  src={like.photo}
                  seed={like.id}
                  name={like.name ?? "Someone"}
                  alt={like.locked ? "Hidden profile" : `${like.name}`}
                />
                <span className="like-scrim" />
                {like.superLike && (
                  <span className="like-super">
                    <Icon name="star-filled" size={13} />
                  </span>
                )}
                <span className="like-label">
                  {like.locked ? "Hidden" : `${like.name?.split(" ")[0]}, ${like.age}`}
                  <br />
                  <span style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.65 }}>
                    {like.locked ? like.cityName : like.cityName}
                  </span>
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
