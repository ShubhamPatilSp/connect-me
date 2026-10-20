"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Photo } from "@/components/media";
import { api } from "@/lib/client/api";
import { useToast } from "@/lib/client/hooks";
import { INTEREST_TAGS } from "@/lib/constants";
import { KHANDESH_CITIES } from "@/lib/geo";
import type { Profile } from "@/lib/types";

interface MeResponse {
  profile: Profile;
}

async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 760;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function EditProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, showToast] = useToast();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [job, setJob] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [cityId, setCityId] = useState("jalgaon");
  const [interests, setInterests] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<MeResponse>("/api/me")
      .then((res) => {
        setName(res.profile.name);
        setBio(res.profile.bio);
        setJob(res.profile.job ?? "");
        setHeightCm(res.profile.heightCm ? String(res.profile.heightCm) : "");
        setCityId(res.profile.cityId);
        setInterests(res.profile.interests);
        setPhotos(res.profile.photos);
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Could not load profile"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: string[] = [];
    for (const file of Array.from(files).slice(0, 6 - photos.length)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        next.push(await fileToDataUrl(file));
      } catch {
        showToast("One image couldn't be read");
      }
    }
    setPhotos((prev) => [...prev, ...next].slice(0, 6));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/api/me", {
        name,
        bio,
        job,
        heightCm: Number(heightCm) || null,
        cityId,
        interests,
        photos,
      });
      showToast("Profile updated");
      router.push("/me");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  };

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => router.push("/me")} aria-label="Back">
          <Icon name="back" size={20} />
        </button>
        <div className="topbar-text">
          <div className="greeting">Edit profile</div>
        </div>
      </header>

      <div style={{ padding: "0 18px 28px", display: "grid", gap: 20 }}>
        {loading ? (
          <div className="skeleton" style={{ height: 220 }} />
        ) : (
          <>
            <div>
              <p className="label" style={{ marginBottom: 10 }}>
                Photos · {photos.length}/6
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {photos.map((src, index) => (
                  <div
                    key={`${index}-${src.slice(0, 16)}`}
                    style={{
                      position: "relative",
                      aspectRatio: "3 / 4",
                      borderRadius: 14,
                      overflow: "hidden",
                      border: index === 0 ? "2px solid var(--brand)" : "1px solid var(--line)",
                    }}
                  >
                    <Photo src={src} seed={`edit-${index}`} name={name} alt="" />
                    <button
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remove"
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: "rgba(0,0,0,0.65)",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </div>
                ))}
                {photos.length < 6 && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      aspectRatio: "3 / 4",
                      borderRadius: 14,
                      border: "1.5px dashed var(--line-strong)",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    <Icon name="plus" size={22} />
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => void addFiles(e.target.files)}
              />
            </div>

            <div className="field">
              <span className="label">Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="field">
              <span className="label">Bio</span>
              <textarea
                className="input"
                value={bio}
                maxLength={500}
                onChange={(e) => setBio(e.target.value)}
              />
              <span className="dim" style={{ fontSize: 11.5, textAlign: "right" }}>
                {bio.length}/500
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field">
                <span className="label">Work</span>
                <input className="input" value={job} onChange={(e) => setJob(e.target.value)} />
              </div>
              <div className="field">
                <span className="label">Height (cm)</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value.replace(/\D/g, "").slice(0, 3))}
                />
              </div>
            </div>

            <div className="field">
              <span className="label">City</span>
              <select
                className="input"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                style={{ appearance: "none" }}
              >
                {(["Jalgaon", "Dhule", "Nandurbar"] as const).map((district) => (
                  <optgroup key={district} label={`${district} district`}>
                    {KHANDESH_CITIES.filter((city) => city.district === district).map((city) => (
                      <option key={city.id} value={city.id} style={{ background: "#161618" }}>
                        {city.name} · {city.local}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="field">
              <span className="label">Interests · {interests.length}</span>
              <div className="chip-row">
                {INTEREST_TAGS.map((tag) => (
                  <button
                    key={tag}
                    className="chip"
                    data-active={interests.includes(tag)}
                    onClick={() =>
                      setInterests((prev) =>
                        prev.includes(tag)
                          ? prev.filter((t) => t !== tag)
                          : prev.length >= 10
                            ? prev
                            : [...prev, tag],
                      )
                    }
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn-primary btn-block" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
