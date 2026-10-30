import { type Lang, type MessageKey } from "@/lib/i18n";
import type { InvitableRole } from "./types";
import { messages } from "@/lib/i18n/messages";

// What a reviewer sends on WhatsApp (docs/field/messages.md §3). The message is Kannada first,
// because the person opening it is a Kannada teacher; the English line exists for the preview.
const SHARE_KEY: Record<InvitableRole, MessageKey> = {
  teacher: "share.teacher",
  master: "share.master",
  reviewer: "share.reviewer",
};

export function inviteLink(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/join/${encodeURIComponent(code)}`;
}

export function shareMessage(role: InvitableRole, link: string, lang: Lang = "kn"): string {
  return messages[lang][SHARE_KEY[role]].replace("{link}", link);
}

/** wa.me with no number opens WhatsApp's own chooser, so the reviewer picks the person. */
export function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
