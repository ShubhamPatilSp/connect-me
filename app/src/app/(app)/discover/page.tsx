"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Photo } from "@/components/media";
import { FilterSheet, type FilterPrefs } from "@/components/FilterSheet";
import { MatchModal } from "@/components/overlays";
import { SwipeDeck, type SwipeDeckHandle, type SwipeDirection } from "@/components/SwipeDeck";
import { api, ApiError } from "@/lib/client/api";
import { useToast } from "@/lib/client/hooks";
import type { DeckCard, Profile } from "@/lib/types";

interface MeResponse {
  user: { id: string; name: string; cityId: string; isPremium: boolean };
  profile: Profile;
  prefs: { ageMin: number; ageMax: number; distanceKm: number; verifiedOnly: boolean };
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

  const [prefs, setPrefs] = useState<FilterPrefs>({
    ageMin: 21,
    ageMax: 40,
    distance: 60,
    verifiedOnly: false,
  });

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
        setPrefs({
          ageMin: meRes.prefs.ageMin,
          ageMax: meRes.prefs.ageMax,
          distance: meRes.prefs.distanceKm,
          verifiedOnly: meRes.prefs.verifiedOnly,
        });
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

  const savePrefs = async (next: FilterPrefs) => {
    setSaving(true);
    try {
      await api.patch("/api/me", {
        prefAgeMin: next.ageMin,
        prefAgeMax: next.ageMax,
        prefDistanceKm: next.distance,
        prefVerifiedOnly: next.verifiedOnly,
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

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        initial={prefs}
        saving={saving}
        onApply={async (next) => {
          setPrefs(next);
          await savePrefs(next);
        }}
      />

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
