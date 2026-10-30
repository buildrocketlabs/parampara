import { ClipboardCheck, HandHeart, Map as MapIcon, Mic, type LucideIcon } from "lucide-react";
import type { AppRole } from "@/lib/auth/roles";
import type { MessageKey } from "@/lib/i18n";

// One icon and one name per role, shared by the doors, the session bar and the invite tools.
export const ROLE_ICON: Record<AppRole, LucideIcon> = {
  teacher: Mic,
  master: HandHeart,
  reviewer: ClipboardCheck,
  officer: MapIcon,
};

export const ROLE_NAME: Record<AppRole, MessageKey> = {
  teacher: "door.teacher.title",
  master: "door.master.title",
  reviewer: "door.reviewer.title",
  officer: "door.officer.title",
};

export const ROLE_ROOM: Record<AppRole, MessageKey> = {
  teacher: "room.teacher",
  master: "room.master",
  reviewer: "room.reviewer",
  officer: "room.officer",
};

export const ROLE_ENTER: Record<AppRole, MessageKey> = {
  teacher: "room.enter.teacher",
  master: "room.enter.master",
  reviewer: "room.enter.reviewer",
  officer: "room.enter.officer",
};
