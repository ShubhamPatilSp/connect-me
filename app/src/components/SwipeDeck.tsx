"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Photo } from "@/components/media";
import { distanceLabel } from "@/lib/client/hooks";
import type { DeckCard } from "@/lib/types";

export type SwipeDirection = "left" | "right" | "up";

export interface SwipeDeckHandle {
  swipe: (direction: SwipeDirection) => void;
}

interface Props {
  cards: DeckCard[];
  onSwipe: (card: DeckCard, direction: SwipeDirection) => void;
  onOpen: (card: DeckCard) => void;
}

const HORIZONTAL_THRESHOLD = 108;
const VERTICAL_THRESHOLD = -132;

export const SwipeDeck = forwardRef<SwipeDeckHandle, Props>(function SwipeDeck(
  { cards, onSwipe, onOpen },
  ref,
) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exit, setExit] = useState<{ x: number; y: number; dir: SwipeDirection } | null>(null);
  const start = useRef({ x: 0, y: 0, id: -1 });
  const delta = useRef({ x: 0, y: 0 });
  const moved = useRef(0);
  const animating = useRef(false);

  const top = cards[0];

  const commit = useCallback(
    (direction: SwipeDirection) => {
      if (!top || animating.current) return;
      animating.current = true;
      const x = direction === "left" ? -640 : direction === "right" ? 640 : 0;
      const y = direction === "up" ? -820 : 60;
      setExit({ x, y, dir: direction });

      window.setTimeout(() => {
        onSwipe(top, direction);
        setExit(null);
        setDrag({ x: 0, y: 0, active: false });
        animating.current = false;
      }, 280);
    },
    [onSwipe, top],
  );

  useImperativeHandle(ref, () => ({ swipe: commit }), [commit]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (animating.current) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    moved.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (start.current.id !== event.pointerId || animating.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    delta.current = { x: dx, y: dy };
    moved.current = Math.max(moved.current, Math.abs(dx) + Math.abs(dy));
    setDrag({ x: dx, y: dy, active: true });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (start.current.id !== event.pointerId) return;
    start.current.id = -1;
    setDrag((d) => ({ ...d, active: false }));

    const { x, y } = delta.current;
    if (x > HORIZONTAL_THRESHOLD) commit("right");
    else if (x < -HORIZONTAL_THRESHOLD) commit("left");
    else if (y < VERTICAL_THRESHOLD) commit("up");
    else if (moved.current < 8 && top) onOpen(top);
  };

  if (cards.length === 0) return null;

  const offsetX = exit ? exit.x : drag.x;
  const offsetY = exit ? exit.y : drag.y;
  const rotate = offsetX / 18;
  const likeOpacity = Math.max(0, Math.min(1, offsetX / HORIZONTAL_THRESHOLD));
  const nopeOpacity = Math.max(0, Math.min(1, -offsetX / HORIZONTAL_THRESHOLD));
  const superOpacity = Math.max(0, Math.min(1, -offsetY / Math.abs(VERTICAL_THRESHOLD)));

  return (
    <div className="deck">
      {cards
        .slice(0, 3)
        .map((card, index) => {
          const isTop = index === 0;
          const depth = index;

          return (
            <div
              key={card.id}
              className="deck-card"
              data-dragging={isTop && drag.active}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? onPointerUp : undefined}
              style={{
                zIndex: 10 - index,
                touchAction: isTop ? "none" : "auto",
                transform: isTop
                  ? `translate3d(${offsetX}px, ${offsetY}px, 0) rotate(${rotate}deg)`
                  : `translate3d(0, ${depth * 12}px, 0) scale(${1 - depth * 0.045})`,
                opacity: isTop ? (exit ? 0.2 : 1) : 1 - depth * 0.25,
                cursor: isTop ? (drag.active ? "grabbing" : "grab") : "default",
              }}
            >
              <div className="deck-media">
                <Photo
                  src={card.photos[0]}
                  seed={card.id}
                  name={card.name}
                  alt={`${card.name}, ${card.age}`}
                />
              </div>
              <div className="deck-scrim" />

              <div className="deck-topline">
                <span className="match-pill">
                  <span className="dot" />
                  {Math.round(card.score * 100)}% match
                </span>
                {card.likesYou && <span className="match-pill">Likes you</span>}
              </div>

              <div className="deck-info">
                <div className="deck-name">
                  {card.name}, {card.age}
                  {card.photoVerified && (
                    <span style={{ color: "#6ea8ff", display: "flex" }} title="Photo verified">
                      <Icon name="verified" size={19} />
                    </span>
                  )}
                </div>
                <div className="deck-meta">
                  <Icon name="pin" size={13} />
                  {card.cityName}
                  {card.distanceKm !== null && (
                    <>
                      <span style={{ opacity: 0.4 }}>·</span>
                      {distanceLabel(card.distanceKm)}
                    </>
                  )}
                </div>
                {card.reasons.length > 0 && (
                  <div className="deck-tags">
                    {card.reasons.slice(0, 3).map((reason) => (
                      <span key={reason} className="deck-tag">
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {isTop && (
                <>
                  <span className="stamp stamp-like" style={{ opacity: likeOpacity }}>
                    Like
                  </span>
                  <span className="stamp stamp-nope" style={{ opacity: nopeOpacity }}>
                    Nope
                  </span>
                  <span
                    className="stamp"
                    style={{
                      opacity: superOpacity,
                      left: "50%",
                      transform: "translateX(-50%) rotate(0deg)",
                      color: "var(--violet)",
                      top: "auto",
                      bottom: 140,
                    }}
                  >
                    Super
                  </span>
                </>
              )}
            </div>
          );
        })
        .reverse()}
    </div>
  );
});
