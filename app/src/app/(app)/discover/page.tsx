"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Photo } from "@/components/media";
import { MatchModal, Sheet } from "@/components/overlays";
import { SwipeDeck, type SwipeDeckHandle, type SwipeDirection } from "@/components/SwipeDeck";
import { api, ApiError } from "@/lib/client/api";
import { useToast } from "@/lib/client/hooks";
import type { DeckCard, Profile } from "@/lib/types";

interface MeResponse {
  user: { id: string; name: string; cityId: string; isPremium: boolean };
  profile: Profile;
  stats: { likesRemaining: number };
}

interface DeckResponse {
  cards: DeckCard[];
  likesRemaining: number;
}

interface SwipeResponse {
  matched: boolean;
  matchId?: string;
  other?: DeckCard;
  likesRemaining: number;
}

export default function DiscoverPage() {
  const router = useRouter();
  const deckRef = useRef<SwipeDeckHandle>(null);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [likesLeft, setLikesLeft] = useState(0);
  const [match, setMatch] = useState<{ card: DeckCard; matchId: string } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, showToast] = useToast();

  const [prefs, setPrefs] = useState({ ageMin: 21, ageMax: 40, distance: 60, verifiedOnly: false });

  const loadDeck = useCallback(async (limit = 12) => {
    const res = await api.get<DeckResponse>(`/api/deck?limit=${limit}`);
    setCards(res.cards);
    setLikesLeft(res.likesRemaining);
    return res.cards;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meRes, deckRes] = await Promise.all([
          api.get<MeResponse>("/api/me"),
          api.get<DeckResponse>("/api/deck?limit=12"),
        ]);
        if (cancelled) return;
        setMe(meRes);
        setCards(deckRes.cards);
        setLikesLeft(deckRes.likesRemaining);
      } catch (err) {
        if (!cancelled) showToast(err instanceof Error ? err.message : "Could not load your deck");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwipe = useCallback(
    async (card: DeckCard, direction: SwipeDirection) => {
      const action = direction === "right" ? "like" : direction === "up" ? "super" : "pass";
      const remaining = cards.filter((c) => c.id !== card.id);
      setCards(remaining);

      try {
        const res = await api.post<SwipeResponse>("/api/swipe", {
          targetId: card.id,
          action,
        });
        setLikesLeft(res.likesRemaining);
        if (res.matched && res.matchId) {
          setMatch({ card, matchId: res.matchId });
        }
      } catch (err) {
        // Put the card back so the UI never silently loses a profile.
        setCards((prev) => [card, ...prev.filter((c) => c.id !== card.id)]);
        if (err instanceof ApiError && err.status === 429) {
          showToast(err.message);
        } else if (err instanceof ApiError && err.status === 409) {
          showToast("Already swiped on them");
        } else {
          showToast(err instanceof Error ? err.message : "Could not save that");
        }
        return;
      }

      if (remaining.length <= 4) {
        void loadDeck(12).catch(() => undefined);
      }
    },
    [cards, loadDeck, showToast],
  );

  const savePrefs = async () => {
    setSaving(true);
    try {
      await api.patch("/api/me", {
        prefAgeMin: prefs.ageMin,
        prefAgeMax: prefs.ageMax,
        prefDistanceKm: prefs.distance,
        prefVerifiedOnly: prefs.verifiedOnly,
      });
      await loadDeck(12);
      setFiltersOpen(false);
      showToast("Deck updated");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save filters");
    } finally {
      setSaving(false);
    }
  };

  const firstName = me?.user.name?.split(" ")[0] ?? "there";
  const myPhoto = me?.profile.photos[0] ?? null;
  const cityName = me?.profile.cityName ?? "Khandesh";

  return (
    <>
      <header className="topbar">
        <div className="avatar-btn">
          <Photo src={myPhoto} seed="me" name={firstName} variant="avatar" alt="" />
        </div>
        <div className="topbar-text">
          <div className="greeting">Hello {firstName}!</div>
          <div className="greeting-sub">
            <Icon name="pin" size={11} />
            {cityName}, Khandesh
          </div>
        </div>
        <button className="icon-btn" onClick={() => setFiltersOpen(true)} aria-label="Filters">
          <Icon name="sliders" size={20} />
        </button>
      </header>

      {loading ? (
        <div className="deck" style={{ margin: "0 16px" }}>
          <div className="skeleton" style={{ position: "absolute", inset: 0, borderRadius: 34 }} />
        </div>
      ) : cards.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="sparkle" size={28} />
          </div>
          <h2 className="h2">You&apos;ve seen everyone nearby</h2>
          <p className="muted" style={{ maxWidth: 280, fontSize: 14 }}>
            Khandesh is small — new people join every day. Widen your distance or check back
            tomorrow.
          </p>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setLoading(true);
              void loadDeck(12).finally(() => setLoading(false));
            }}
          >
            Refresh deck
          </button>
        </div>
      ) : (
        <SwipeDeck
          ref={deckRef}
          cards={cards}
          onSwipe={handleSwipe}
          onOpen={(card) => router.push(`/u/${card.id}`)}
        />
      )}

      {cards.length > 0 && (
        <div className="actions">
          <button
            className="action action-undo"
            onClick={() => showToast("Rewind is a Plus feature")}
            aria-label="Undo"
          >
            <Icon name="undo" size={19} />
          </button>
          <button
            className="action action-pass"
            onClick={() => deckRef.current?.swipe("left")}
            aria-label="Pass"
          >
            <Icon name="close" size={26} />
          </button>
          <button
            className="action action-super"
            onClick={() => deckRef.current?.swipe("up")}
            aria-label="Super like"
          >
            <Icon name="star-filled" size={22} />
          </button>
          <button
            className="action action-like"
            onClick={() => deckRef.current?.swipe("right")}
            aria-label="Like"
          >
            <Icon name="heart-filled" size={26} />
          </button>
        </div>
      )}

      <div style={{ textAlign: "center", paddingBottom: 10 }}>
        <span className="dim" style={{ fontSize: 11.5 }}>
          {me?.user.isPremium ? "Unlimited likes" : `${likesLeft} likes left today`} · Swipe or use
          the buttons
        </span>
      </div>

      {match && me && (
        <MatchModal
          me={{ name: firstName, photo: myPhoto }}
          other={{ name: match.card.name, photo: match.card.photos[0] ?? null }}
          onClose={() => setMatch(null)}
          onMessage={() => router.push(`/chat/${match.matchId}`)}
        />
      )}

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Discovery filters"
        subtitle="Only applies inside Khandesh — you can't search outside the region."
      >
        <div style={{ marginBottom: 22 }}>
          <div className="slider-row">
            <span className="label">Age range</span>
            <span className="slider-value">
              {prefs.ageMin} – {prefs.ageMax}
            </span>
          </div>
          <input
            type="range"
            min={18}
            max={60}
            value={prefs.ageMin}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, ageMin: Math.min(Number(e.target.value), p.ageMax - 1) }))
            }
          />
          <div style={{ height: 12 }} />
          <input
            type="range"
            min={18}
            max={60}
            value={prefs.ageMax}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, ageMax: Math.max(Number(e.target.value), p.ageMin + 1) }))
            }
          />
        </div>

        <div style={{ marginBottom: 22 }}>
          <div className="slider-row">
            <span className="label">Maximum distance</span>
            <span className="slider-value">{prefs.distance} km</span>
          </div>
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={prefs.distance}
            onChange={(e) => setPrefs((p) => ({ ...p, distance: Number(e.target.value) }))}
          />
        </div>

        <div className="switch-row" style={{ borderTop: "1px solid var(--line)" }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Verified profiles only</div>
            <div className="dim" style={{ fontSize: 12.5 }}>
              Only show people who passed photo verification
            </div>
          </div>
          <button
            className="switch"
            data-on={prefs.verifiedOnly}
            onClick={() => setPrefs((p) => ({ ...p, verifiedOnly: !p.verifiedOnly }))}
            aria-label="Verified only"
          />
        </div>

        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 16 }}
          onClick={() => void savePrefs()}
          disabled={saving}
        >
          {saving ? "Updating…" : "Apply filters"}
        </button>
      </Sheet>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
