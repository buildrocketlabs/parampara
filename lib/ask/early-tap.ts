// A tap before the page's script has arrived is never silently lost (F-P1: on Slow 3G the ask
// screen's chips show seconds before React can answer a tap). EARLY_TAP_SCRIPT is inlined in the
// HTML of /t/ask (app/t/ask/page.tsx), so it runs as soon as it is parsed. Until AskFlow says it is
// ready, it holds a tap on any button inside [data-early-zone]: the page says "getting ready"
// (html[data-early-wait]), the pressed button is marked (data-early-held), and the first tap's key
// (its data-early, or "mic" for the MicOrb) waits in window.__ppEarly. AskFlow then takes it once
// hydrated: a chip's question is sent; the mic is never started late, she is told it is ready.

export type EarlyWindow = Window & { __ppReady?: boolean; __ppEarly?: string };

export const EARLY_TAP_SCRIPT = `(function(){var d=document,w=window;d.addEventListener("click",function(e){if(w.__ppReady)return;var t=e.target,b=t&&t.closest?t.closest("[data-early-zone] button"):null;if(!b)return;e.preventDefault();e.stopPropagation();var k=b.getAttribute("data-early")||(b.hasAttribute("data-state")?"mic":"");if(k&&!w.__ppEarly){w.__ppEarly=k;b.setAttribute("data-early-held","")}d.documentElement.setAttribute("data-early-wait","")},true)})();`;

/** Called once by AskFlow after hydration: from now on taps are React's. Returns the held key. */
export function takeEarlyTap(): string | null {
  const w = window as EarlyWindow;
  w.__ppReady = true;
  const key = w.__ppEarly ?? null;
  w.__ppEarly = undefined;
  document.documentElement.removeAttribute("data-early-wait");
  document
    .querySelectorAll("[data-early-held]")
    .forEach((el) => el.removeAttribute("data-early-held"));
  return key;
}
