"use client";

import type { SVGProps } from "react";

type IconName =
  | "home"
  | "heart"
  | "heart-filled"
  | "mail"
  | "user"
  | "search"
  | "settings"
  | "edit"
  | "back"
  | "chevron"
  | "close"
  | "star"
  | "star-filled"
  | "undo"
  | "send"
  | "check"
  | "verified"
  | "pin"
  | "shield"
  | "logout"
  | "sliders"
  | "lock"
  | "plus"
  | "camera"
  | "sparkle"
  | "message"
  | "flag"
  | "block";

const PATHS: Record<IconName, string> = {
  home: "M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5",
  heart:
    "M12 20.5s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 8.2a4.4 4.4 0 0 1 7.5 2.7c0 5-7.5 9.6-7.5 9.6Z",
  "heart-filled":
    "M12 20.8s-8-4.9-8-10.2A4.7 4.7 0 0 1 12 7.6a4.7 4.7 0 0 1 8 3c0 5.3-8 10.2-8 10.2Z",
  mail: "M3.5 7.5h17v11h-17zM3.5 8l8.5 6 8.5-6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16.2 16.2 21 21",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z",
  edit: "M4 20h4L20 8l-4-4L4 16v4ZM14.5 5.5l4 4",
  back: "M15 5l-7 7 7 7",
  chevron: "M9 5l7 7-7 7",
  close: "M6 6l12 12M18 6 6 18",
  star: "M12 3.5l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8z",
  "star-filled": "M12 3.5l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8z",
  undo: "M4 10h9a5 5 0 0 1 0 10H8M4 10l4-4M4 10l4 4",
  send: "M4 12l16-8-6 8 6 8-16-8Z",
  check: "M4.5 12.5 9 17l10.5-10.5",
  verified: "M12 2.5l2.4 1.8 3-.2 1 2.8 2.6 1.5-.9 2.9.9 2.9-2.6 1.5-1 2.8-3-.2L12 21.5l-2.4-1.8-3 .2-1-2.8L3 15.6l.9-2.9L3 9.8l2.6-1.5 1-2.8 3 .2z M8.8 12.2l2.2 2.2 4.2-4.4",
  pin: "M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  shield: "M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6z",
  logout: "M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13A1.5 1.5 0 0 1 18.5 20H15M10 8l-4 4 4 4M6 12h10",
  sliders: "M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0M14 5v4M8 10v4M16 15v4",
  lock: "M6.5 10.5h11v9h-11zM9 10.5V8a3 3 0 0 1 6 0v2.5",
  plus: "M12 5v14M5 12h14",
  camera: "M4 8.5h3l1.5-2h7L17 8.5h3v10H4zM12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z",
  message: "M4 5.5h16v11H9l-5 4z",
  flag: "M6 21V4h11l-1.5 4L17 12H6",
  block: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM6 6l12 12",
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  filled?: boolean;
}

export function Icon({ name, size = 24, filled = false, ...rest }: IconProps) {
  const isFill = filled || name.endsWith("-filled");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type { IconName };
