"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { LocationPicker, type LocationValue } from "@/components/LocationPicker";
import { Photo } from "@/components/media";
import { api } from "@/lib/client/api";
import { signInWithEmail, signUpWithEmail } from "@/lib/client/firebase-auth";
import { GENDERS, INTEREST_TAGS, INTENTS, SEEKING } from "@/lib/constants";
import styles from "./onboarding.module.css";

const TOTAL_STEPS = 7;

const SAMPLE_PHOTOS = [
  "/seed/w01.jpg",
  "/seed/w02.jpg",
  "/seed/w03.jpg",
  "/seed/w04.jpg",
  "/seed/w05.jpg",
  "/seed/w06.jpg",
  "/seed/m01.jpg",
  "/seed/m02.jpg",
  "/seed/m03.jpg",
  "/seed/m04.jpg",
  "/seed/m05.jpg",
  "/seed/m06.jpg",
];

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

export default function OnboardingPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<"email" | "phone">("email");
  const [emailMode, setEmailMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState<string>("woman");
  const [seeking, setSeeking] = useState<string>("men");

  const [location, setLocation] = useState<LocationValue | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyFade, setBodyFade] = useState(false);

  const [photos, setPhotos] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  const [intent, setIntent] = useState<string>("longterm");
  const [bio, setBio] = useState("");
  const [job, setJob] = useState("");
  const [heightCm, setHeightCm] = useState("");

  const maxBirthdate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().slice(0, 10);
  }, []);

  // Inside the Android shell, phone auth runs natively: Firebase verifies the
  // app with Play Integrity and can auto-retrieve the SMS code. In a browser we
  // fall back to the server-side OTP flow.
  const nativeAuth = useRef(false);
  const [nativeReady, setNativeReady] = useState(false);

  useEffect(() => {
    const bridge = (window as unknown as { AndroidBridge?: { hasNativeAuth?: () => boolean } })
      .AndroidBridge;
    nativeAuth.current = Boolean(bridge?.hasNativeAuth?.());
    setNativeReady(nativeAuth.current);
    if (!nativeAuth.current) return;

    const win = window as unknown as { ConnexaNative?: Record<string, unknown> };
    win.ConnexaNative = {
      onCodeSent: () => {
        setBusy(false);
        setStep(1);
      },
      onToken: async (idToken: string) => {
        try {
          const res = await api.post<{ onboardingComplete: boolean }>("/api/auth/firebase", {
            idToken,
          });
          if (res.onboardingComplete) {
            router.push("/discover");
            router.refresh();
          } else {
            setStep(2);
            setBusy(false);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not sign you in");
          setBusy(false);
        }
      },
      onError: (message: string) => {
        setError(message || "Verification failed");
        setBusy(false);
      },
      onCancelled: () => {
        setBusy(false);
      },
    };

    return () => {
      delete win.ConnexaNative;
    };
  }, [router]);

  // Signal "there is more below" instead of a hard cut at the fold.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const update = () => {
      setBodyFade(el.scrollHeight - el.clientHeight - el.scrollTop > 8);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [step]);

  // Email sign-in skips the OTP screen, so the step count depends on the method.
  const totalSteps = authMode === "email" ? TOTAL_STEPS - 1 : TOTAL_STEPS;
  const displayIndex = step === 0 ? 1 : authMode === "email" ? step : step + 1;
  const progress = (displayIndex / totalSteps) * 100;

  const submitEmail = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const idToken =
        emailMode === "signup"
          ? await signUpWithEmail(email, password)
          : await signInWithEmail(email, password);
      const res = await api.post<{ onboardingComplete: boolean }>("/api/auth/firebase", {
        idToken,
      });
      if (res.onboardingComplete) {
        router.push("/discover");
        router.refresh();
        return;
      }
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign you in");
    } finally {
      setBusy(false);
    }
  }, [email, password, emailMode, router]);

  const back = () => {
    setError(null);
    if (step === 0) {
      router.push("/");
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  };

  const sendCode = useCallback(async () => {
    setError(null);
    setDevCode(null);
    setCode("");

    if (nativeAuth.current) {
      setBusy(true);
      try {
        (window as unknown as { AndroidBridge: { startPhoneAuth: (p: string) => void } })
          .AndroidBridge.startPhoneAuth(phone);
      } catch {
        setError("Could not start verification");
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const result = await api.post<{ devCode: string | null }>("/api/auth/request-otp", {
        phone,
      });
      setDevCode(result.devCode);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  }, [phone]);

  const verifyCode = useCallback(async () => {
    if (nativeAuth.current) {
      setError(null);
      setBusy(true);
      try {
        (window as unknown as { AndroidBridge: { confirmPhoneCode: (c: string) => void } })
          .AndroidBridge.confirmPhoneCode(code);
      } catch {
        setError("Could not verify that code");
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ onboardingComplete: boolean }>("/api/auth/verify", {
        phone,
        code,
      });
      if (res.onboardingComplete) {
        router.push("/discover");
        router.refresh();
        return;
      }
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work");
    } finally {
      setBusy(false);
    }
  }, [phone, code, router]);

  const submit = useCallback(async () => {
    if (!location) {
      setError("Choose your location to continue");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/onboarding", {
        name,
        birthdate,
        gender,
        seeking,
        cityId: location.label,
        lat: location.lat,
        lng: location.lng,
        intent,
        bio,
        job,
        heightCm: Number(heightCm) || null,
        photos,
        interests,
      });
      router.push("/discover");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
      setBusy(false);
    }
  }, [name, birthdate, gender, seeking, location, intent, bio, job, heightCm, photos, interests, router]);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const next: string[] = [];
    for (const file of Array.from(files).slice(0, 6 - photos.length)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        next.push(await fileToDataUrl(file));
      } catch {
        setError("One of those images couldn't be read");
      }
    }
    setPhotos((prev) => [...prev, ...next].slice(0, 6));
  };

  const toggle = (list: string[], value: string, limit: number): string[] => {
    if (list.includes(value)) return list.filter((v) => v !== value);
    if (list.length >= limit) return list;
    return [...list, value];
  };

  const canContinue = (): boolean => {
    switch (step) {
      case 0:
        if (authMode === "email") {
          return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && password.length >= 8;
        }
        return (
          /^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").slice(-10)) &&
          phone.replace(/\D/g, "").length >= 10
        );
      case 1:
        return code.length === 6;
      case 2:
        return name.trim().length >= 2 && birthdate.length === 10;
      case 3:
        return location !== null;
      case 4:
        return photos.length >= 1;
      case 5:
        return interests.length >= 3;
      case 6:
        return true;
      default:
        return false;
    }
  };

  const next = () => {
    if (step === 0) {
      if (authMode === "email") void submitEmail();
      else void sendCode();
    } else if (step === 1) void verifyCode();
    else if (step === 6) void submit();
    else setStep((s) => s + 1);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <button className="icon-btn" onClick={back} aria-label="Back">
          <Icon name="back" size={20} />
        </button>
        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.stepCount}>
          {displayIndex}/{totalSteps}
        </span>
      </div>
      <div className={styles.body} ref={bodyRef} data-fade={bodyFade}>
        {step === 0 && (
          <div className="rise">
            <p className={styles.kicker}>Step one</p>
            <h1 className={styles.title}>
              {authMode === "email"
                ? emailMode === "signup"
                  ? "Create your account"
                  : "Welcome back"
                : "What's your number?"}
            </h1>
            <p className={styles.lead}>
              {authMode === "email"
                ? "Email and a password. No SMS, no waiting for a code."
                : "We'll text you a 6-digit code. No passwords, no spam — just proof it's really you."}
            </p>

            {nativeReady && (
              <>
                <button
                  onClick={() => {
                    setError(null);
                    setBusy(true);
                    (window as unknown as { AndroidBridge: { signInWithGoogle: () => void } })
                      .AndroidBridge.signInWithGoogle();
                  }}
                  style={{
                    width: "100%",
                    height: 54,
                    borderRadius: 999,
                    background: "#ffffff",
                    color: "#1a1a1a",
                    fontWeight: 600,
                    fontSize: 15,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    marginBottom: 18,
                  }}
                >
                  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  Continue with Google
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
                  <span className="dim" style={{ fontSize: 11 }}>
                    or
                  </span>
                  <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>
              </>
            )}

            <div className="chip-row" style={{ marginBottom: 22 }}>              <button
                className="chip"
                data-active={authMode === "email"}
                onClick={() => {
                  setAuthMode("email");
                  setError(null);
                }}
              >
                Email
              </button>
              <button
                className="chip"
                data-active={authMode === "phone"}
                onClick={() => {
                  setAuthMode("phone");
                  setError(null);
                }}
              >
                Phone
              </button>
            </div>

            {authMode === "email" ? (
              <div className={styles.stack}>
                <div className="field">
                  <span className="label">Email</span>
                  <input
                    className="input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="field">
                  <span className="label">Password</span>
                  <input
                    className="input"
                    type="password"
                    autoComplete={emailMode === "signup" ? "new-password" : "current-password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && canContinue() && next()}
                  />
                </div>

                <button
                  className="dim"
                  style={{
                    background: "none",
                    padding: 0,
                    textAlign: "left",
                    fontSize: 13,
                    textDecoration: "underline",
                  }}
                  onClick={() => {
                    setEmailMode((m) => (m === "signup" ? "signin" : "signup"));
                    setError(null);
                  }}
                >
                  {emailMode === "signup"
                    ? "Already have an account? Sign in"
                    : "New here? Create an account"}
                </button>
              </div>
            ) : (
              <div className={styles.phoneWrap}>
                <span className={styles.prefix}>+91</span>
                <input
                  className={styles.phoneInput}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                  onKeyDown={(e) => e.key === "Enter" && canContinue() && next()}
                />
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="rise">
            <p className={styles.kicker}>Verify</p>
            <h1 className={styles.title}>Enter the code</h1>
            <p className={styles.lead}>Sent to +91 {phone}. It expires in 5 minutes.</p>

            <input
              className={styles.otpInput}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && canContinue() && next()}
            />

            {devCode && (
              <div className={styles.hint} style={{ marginTop: 16 }}>
                <Icon name="sparkle" size={16} />
                <span>
                  Local development code: <code>{devCode}</code>
                </span>
              </div>
            )}

            <button
              className="btn btn-sm btn-ghost"
              style={{ marginTop: 18 }}
              onClick={() => void sendCode()}
              disabled={busy}
            >
              Resend code
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="rise">
            <p className={styles.kicker}>About you</p>
            <h1 className={styles.title}>The basics</h1>
            <p className={styles.lead}>This is what people see first. Keep it real.</p>

            <div className={styles.stack}>
              <div className="field">
                <span className="label">First name</span>
                <input
                  className="input"
                  placeholder="Hitesh"
                  value={name}
                  maxLength={40}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="field">
                <span className="label">Date of birth</span>
                <input
                  className="input"
                  type="date"
                  max={maxBirthdate}
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                />
              </div>

              <div className="field">
                <span className="label">I am a</span>
                <div className="chip-row">
                  {GENDERS.map((g) => (
                    <button
                      key={g.id}
                      className="chip"
                      data-active={gender === g.id}
                      onClick={() => setGender(g.id)}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="label">Show me</span>
                <div className="chip-row">
                  {SEEKING.map((s) => (
                    <button
                      key={s.id}
                      className="chip"
                      data-active={seeking === s.id}
                      onClick={() => setSeeking(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rise">
            <p className={styles.kicker}>Location</p>
            <h1 className={styles.title}>Where are you?</h1>
            <p className={styles.lead}>
              Choose your current location so we can find people within your discovery radius.
            </p>
            <LocationPicker value={location} onChange={setLocation} />
          </div>
        )}

        {step === 4 && (
          <div className="rise">
            <p className={styles.kicker}>Photos</p>
            <h1 className={styles.title}>Add your photos</h1>
            <p className={styles.lead}>
              Upload from your phone, or pick a sample to move fast. First photo is your main one.
            </p>

            <div className={styles.photoGrid}>
              {photos.map((src, index) => (
                <div key={`${src.slice(0, 24)}-${index}`} className={styles.photoTile} data-selected>
                  <Photo src={src} seed={`me-${index}`} name={name || "You"} alt="" />
                  <span className={styles.photoIndex}>{index + 1}</span>
                  <button
                    onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="Remove photo"
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
                <button className={styles.uploadTile} onClick={() => fileRef.current?.click()}>
                  <Icon name="plus" size={22} />
                  Upload
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

            <div className="divider" />
            <p className="label" style={{ marginBottom: 10 }}>
              Or pick a sample
            </p>
            <div className={styles.photoGrid}>
              {SAMPLE_PHOTOS.map((src) => {
                const selected = photos.includes(src);
                return (
                  <button
                    key={src}
                    className={styles.photoTile}
                    data-selected={selected}
                    onClick={() => setPhotos((prev) => toggle(prev, src, 6))}
                  >
                    <Photo src={src} seed={src} name="Sample" alt="" />
                    {selected && <span className={styles.photoIndex}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="rise">
            <p className={styles.kicker}>Interests</p>
            <h1 className={styles.title}>What are you into?</h1>
            <p className={styles.lead}>
              Pick at least 3. We use these to rank your deck — shared interests carry real weight.
            </p>

            <div className="chip-row">
              {INTEREST_TAGS.map((tag) => (
                <button
                  key={tag}
                  className="chip"
                  data-active={interests.includes(tag)}
                  onClick={() => setInterests((prev) => toggle(prev, tag, 10))}
                >
                  {tag}
                </button>
              ))}
            </div>

            <p className="muted" style={{ marginTop: 18, fontSize: 13 }}>
              {interests.length} selected
            </p>
          </div>
        )}

        {step === 6 && (
          <div className="rise">
            <p className={styles.kicker}>Last step</p>
            <h1 className={styles.title}>What brings you here?</h1>
            <p className={styles.lead}>Be honest — it filters out people who want something different.</p>

            <div className={styles.stack}>
              {INTENTS.map((item) => (
                <button
                  key={item.id}
                  className={styles.intentCard}
                  data-active={intent === item.id}
                  onClick={() => setIntent(item.id)}
                >
                  <span className={styles.intentIcon}>
                    <Icon name={item.id === "marriage" ? "shield" : item.id === "casual" ? "sparkle" : "heart"} size={19} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: 14.5 }}>
                      {item.label}
                    </span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--text-dim)" }}>
                      {item.hint}
                    </span>
                  </span>
                  {intent === item.id && (
                    <span style={{ color: "var(--brand)" }}>
                      <Icon name="check" size={18} />
                    </span>
                  )}
                </button>
              ))}

              <div className="field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className="label">Short bio</span>
                  <span className="dim" style={{ fontSize: 11 }}>
                    {bio.length}/500
                  </span>
                </div>
                <textarea
                  className="input"
                  placeholder="Building things on the internet. Looking for someone to share a good meal with."
                  value={bio}
                  maxLength={500}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              <div className={styles.row2}>
                <div className="field">
                  <span className="label">Work</span>
                  <input
                    className="input"
                    placeholder="Designer"
                    value={job}
                    maxLength={60}
                    onChange={(e) => setJob(e.target.value)}
                  />
                </div>
                <div className="field">
                  <span className="label">Height (cm)</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    placeholder="170"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className={styles.err} style={{ marginTop: 18 }}>
            <Icon name="close" size={15} />
            {error}
          </p>
        )}
      </div>

      <div className={styles.foot}>
        <button
          className="btn btn-primary btn-block"
          onClick={next}
          disabled={!canContinue() || busy}
        >
          {busy
            ? "Working…"
            : step === 0
              ? authMode === "email"
                ? emailMode === "signup"
                  ? "Create account"
                  : "Sign in"
                : "Send code"
              : step === 1
                ? "Verify"
                : step === 6
                  ? "Create my profile"
                  : "Continue"}
          {!busy && <Icon name="chevron" size={18} />}
        </button>
        <p className={styles.legal}>
          By continuing you agree to our Terms and confirm you&apos;re 18 or older.
        </p>
      </div>
    </div>
  );
}
