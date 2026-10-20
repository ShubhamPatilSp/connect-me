"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { api } from "@/lib/client/api";
import { useRealtime } from "@/lib/client/hooks";

interface NavCounts {
  likes: number;
  unread: number;
}

const TABS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/discover", label: "Discover", icon: "home" },
  { href: "/likes", label: "Likes", icon: "heart" },
  { href: "/matches", label: "Matches", icon: "mail" },
  { href: "/me", label: "Profile", icon: "user" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname.startsWith("/chat/") || pathname.startsWith("/u/");
  const [counts, setCounts] = useState<NavCounts>({ likes: 0, unread: 0 });

  const load = async () => {
    try {
      const [likes, matches] = await Promise.all([
        api.get<{ total: number }>("/api/likes"),
        api.get<{ matches: Array<{ unreadCount: number }> }>("/api/matches"),
      ]);
      setCounts({
        likes: likes.total,
        unread: matches.matches.reduce((sum, m) => sum + m.unreadCount, 0),
      });
    } catch {
      /* badge counts are non-critical */
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useRealtime((event) => {
    if (event.type === "match") {
      setCounts((c) => ({ ...c, likes: Math.max(0, c.likes - 1) }));
    }
    if (event.type === "message") {
      setCounts((c) => ({ ...c, unread: c.unread + 1 }));
    }
  }, !hideNav);

  return (
    <div className="shell">
      <div className={`shell-main ${hideNav ? "no-nav" : ""}`}>{children}</div>

      {!hideNav && (
        <nav className="nav" aria-label="Main">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const badge = tab.href === "/likes" ? counts.likes : tab.href === "/matches" ? counts.unread : 0;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="nav-item"
                data-active={active}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  name={tab.icon}
                  size={23}
                  filled={active && (tab.icon === "heart" || tab.icon === "home")}
                />
                {badge > 0 && <span className="nav-badge">{badge > 9 ? "9+" : badge}</span>}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
