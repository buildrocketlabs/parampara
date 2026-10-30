import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
// The app's own font files (assets/fonts, OFL), bundled from where they live, not copied.
import balooBold from "../../assets/fonts/BalooTamma2-Bold.ttf";
import jakartaRegular from "../../assets/fonts/PlusJakartaSans-Regular.ttf";
import jakartaSemiBold from "../../assets/fonts/PlusJakartaSans-SemiBold.ttf";

// Every frame waits until the fonts are in, so no frame is rendered in a fallback face and
// Kannada conjuncts are shaped by the real font (HarfBuzz in Chrome).
const faces: Array<[family: string, url: string, descriptors: FontFaceDescriptors]> = [
  ["Baloo Tamma 2", balooBold, { weight: "500 800" }],
  ["Plus Jakarta Sans", jakartaRegular, { weight: "400" }],
  ["Plus Jakarta Sans", jakartaSemiBold, { weight: "600 700" }],
  // Variable font (wdth, wght), downloaded from google/fonts with its OFL (public/fonts).
  ["Noto Sans Kannada", staticFile("fonts/NotoSansKannada.ttf"), { weight: "100 900" }],
];

let started = false;

export function loadFonts() {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading Baloo Tamma 2, Plus Jakarta Sans and Noto Sans Kannada");
  Promise.all(
    faces.map(async ([family, url, descriptors]) => {
      const face = new FontFace(family, `url(${url})`, descriptors);
      await face.load();
      document.fonts.add(face);
    }),
  )
    .then(() => continueRender(handle))
    // A missing font fails the render: a fallback face would break Kannada shaping.
    .catch((err: unknown) => cancelRender(err));
}
