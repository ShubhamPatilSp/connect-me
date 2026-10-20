"use client";

import { useEffect } from "react";

import { Icon } from "@/components/icons";
import { Photo } from "@/components/media";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, title, subtitle, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sheet-grip" />
        {title && <h2 className="sheet-title">{title}</h2>}
        {subtitle && <p className="sheet-sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

interface MatchModalProps {
  me: { name: string; photo: string | null };
  other: { name: string; photo: string | null };
  onClose: () => void;
  onMessage: () => void;
}

export function MatchModal({ me, other, onClose, onMessage }: MatchModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="It's a match">
      <div className="modal">
        <div className="match-avatars">
          <div>
            <Photo src={me.photo} seed="me" name={me.name} variant="avatar" alt="" />
          </div>
          <div>
            <Photo src={other.photo} seed={other.name} name={other.name} variant="avatar" alt="" />
          </div>
        </div>

        <p className="eyebrow" style={{ color: "var(--brand)", marginBottom: 8 }}>
          It&apos;s a match
        </p>
        <h2 style={{ fontSize: 25, fontWeight: 750, letterSpacing: "-0.03em", margin: "0 0 8px" }}>
          You and {other.name.split(" ")[0]} liked each other
        </h2>
        <p className="muted" style={{ fontSize: 13.5, margin: "0 0 22px" }}>
          Nobody can message first except you. Say something better than &ldquo;hi&rdquo;.
        </p>

        <button className="btn btn-primary btn-block" onClick={onMessage}>
          <Icon name="message" size={18} />
          Send a message
        </button>
        <button
          className="btn btn-ghost btn-block"
          style={{ marginTop: 10 }}
          onClick={onClose}
        >
          Keep swiping
        </button>
      </div>
    </div>
  );
}
