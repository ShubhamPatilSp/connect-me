"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { FilterSheet, type FilterPrefs } from "@/components/FilterSheet";
import { api } from "@/lib/client/api";
import { useToast } from "@/lib/client/hooks";
import type { Profile } from "@/lib/types";

interface MeResponse {
  user: { id: string; name: string; phone: string | null; email: string | null; isPremium: boolean; photoVerified: boolean };
  profile: Profile;
  prefs: { ageMin: number; ageMax: number; distanceKm: number; verifiedOnly: boolean };
}

export default function SettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<MeResponse | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [prefs, setPrefs] = useState({ ageMin: 21, ageMax: 40, distance: 60, verifiedOnly: false });
  const [saving, setSaving] = useState(false);
  const [toast, showToast] = useToast();

  useEffect(() => {
    api
      .get<MeResponse>("/api/me")
      .then((res) => {
        setData(res);
        setPrefs({
          ageMin: res.prefs.ageMin,
          ageMax: res.prefs.ageMax,
          distance: res.prefs.distanceKm,
          verifiedOnly: res.prefs.verifiedOnly,
        });
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Could not load settings"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePrefs = async (next: FilterPrefs) => {
    setSaving(true);
    try {
      await api.patch("/api/me", {
        prefAgeMin: next.ageMin,
        prefAgeMax: next.ageMax,
        prefDistanceKm: next.distance,
        prefVerifiedOnly: next.verifiedOnly,
      });
      setFiltersOpen(false);
      showToast("Preferences saved");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const togglePremium = async () => {
    if (!data) return;
    try {
      await api.post("/api/premium", { enable: !data.user.isPremium });
      const res = await api.get<MeResponse>("/api/me");
      setData(res);
      showToast(res.user.isPremium ? "Connect Me Plus active" : "Back to the free plan");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not change plan");
    }
  };

  const logout = async () => {
    await api.post("/api/auth/logout");
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => router.push("/me")} aria-label="Back">
          <Icon name="back" size={20} />
        </button>
        <div className="topbar-text">
          <div className="greeting">Settings</div>
        </div>
      </header>

      <div className="settings-group">
        <div
          style={{
            padding: 18,
            borderRadius: 18,
            background: data?.user.isPremium
              ? "linear-gradient(135deg, rgba(255,90,43,0.22), rgba(124,92,255,0.16))"
              : "linear-gradient(135deg, rgba(255,90,43,0.12), rgba(124,92,255,0.1))",
            border: "1px solid rgba(255,90,43,0.28)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Icon name="sparkle" size={17} />
            <span style={{ fontWeight: 700, fontSize: 15.5 }}>
              {data?.user.isPremium ? "Connect Me Plus is active" : "Connect Me Plus"}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
            {data?.user.isPremium
              ? "Unlimited likes, see everyone who liked you, rewind your last swipe."
              : "Unlimited likes, see who liked you first, and rewind a bad swipe."}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => void togglePremium()}>
            {data?.user.isPremium ? "Switch back to free" : "Unlock Plus"}
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="list">
          <button className="list-row" style={{ width: "100%" }} onClick={() => setFiltersOpen(true)}>
            <span className="row-icon">
              <Icon name="sliders" size={17} />
            </span>
            <span style={{ flex: 1, textAlign: "left" }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 14.5 }}>Discovery</span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--text-dim)" }}>
                {data ? `${data.prefs.ageMin}–${data.prefs.ageMax} yrs · within ${data.prefs.distanceKm} km` : "…"}
              </span>
            </span>
            <span className="chev">
              <Icon name="chevron" size={17} />
            </span>
          </button>

          <div className="list-row">
            <span className="row-icon">
              <Icon name="user" size={17} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 14.5 }}>
                {data?.user.phone ? "Phone number" : "Email"}
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--text-dim)" }}>
                {data?.user.phone ?? data?.user.email ?? "…"}
              </span>
            </span>
          </div>

          <div className="list-row">
            <span className="row-icon" style={{ color: data?.user.photoVerified ? "var(--green)" : undefined }}>
              <Icon name="verified" size={17} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 14.5 }}>Photo verification</span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--text-dim)" }}>
                {data?.user.photoVerified ? "Verified — badge is visible" : "Not verified yet"}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="list">
          <button
            className="list-row"
            style={{ width: "100%" }}
            onClick={() => showToast("Safety centre is a demo placeholder")}
          >
            <span className="row-icon">
              <Icon name="shield" size={17} />
            </span>
            <span style={{ flex: 1, textAlign: "left", fontWeight: 600, fontSize: 14.5 }}>
              Safety centre
            </span>
            <span className="chev">
              <Icon name="chevron" size={17} />
            </span>
          </button>
          <button
            className="list-row"
            style={{ width: "100%" }}
            onClick={() => showToast("Only Khandesh cities are supported")}
          >
            <span className="row-icon">
              <Icon name="pin" size={17} />
            </span>
            <span style={{ flex: 1, textAlign: "left" }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 14.5 }}>Region</span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--text-dim)" }}>
                Jalgaon · Dhule · Nandurbar
              </span>
            </span>
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="list">
          <button
            className="list-row"
            style={{ width: "100%", color: "var(--danger)" }}
            onClick={() => void logout()}
          >
            <span className="row-icon" style={{ color: "var(--danger)" }}>
              <Icon name="logout" size={17} />
            </span>
            <span style={{ flex: 1, textAlign: "left", fontWeight: 600, fontSize: 14.5 }}>Log out</span>
          </button>
        </div>
      </div>

      <p className="dim" style={{ textAlign: "center", fontSize: 11.5, padding: "0 24px 28px" }}>
        Connect Me v1.0 · Built for Khandesh · 18+
      </p>

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
