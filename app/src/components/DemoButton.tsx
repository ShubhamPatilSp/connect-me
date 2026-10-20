"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { api } from "@/lib/client/api";

/** One-tap demo entry. Keeps the reviewer inside the product in one click. */
export function DemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/demo");
      router.push("/discover");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the demo");
      setBusy(false);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <button className="btn btn-ghost btn-block" onClick={enter} disabled={busy}>
        {busy ? "Opening…" : "Explore the demo account"}
        {!busy && <Icon name="chevron" size={18} />}
      </button>
      {error && (
        <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--danger)", textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}
