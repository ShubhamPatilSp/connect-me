import { redirect } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { getSessionRow } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionRow();
  if (!user) redirect("/");
  if (!user.onboarding_complete) redirect("/onboarding");
  return <AppShell>{children}</AppShell>;
}
