import type { MetadataRoute } from "next";
import { colors } from "@/lib/tokens";

// Installable app (DESIGN §10, D3): opens straight into the teacher's room with Hanate on the
// home screen. Kannada name first.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ಪರಂಪರೆ · Parampara",
    short_name: "ಪರಂಪರೆ",
    description:
      "The classroom wisdom of Karnataka's master teachers, in their own voice, for every young teacher.",
    lang: "kn",
    start_url: "/t",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: colors.cream,
    theme_color: colors.cream,
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "ಉಳಿಸಿದ ಉತ್ತರಗಳು · Saved answers",
        url: "/t/saved",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
