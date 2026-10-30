import { createContext, useContext, type ReactNode } from "react";
import { getStaticFiles, staticFile } from "remotion";
import { formatNumber, isTodo, type Numbers } from "./schema";
import { colors, fonts } from "./theme";

export type Mode = "draft" | "final";

export type StoryContextValue = {
  mode: Mode;
  numbers: Numbers;
};

export const StoryContext = createContext<StoryContextValue>({
  mode: "draft",
  numbers: { numbers: {} },
});

export const useStory = () => useContext(StoryContext);

/** Files in video/public, as Remotion sees them (Studio and rendering). */
export function hasAsset(path: string): boolean {
  return getStaticFiles().some((f) => f.name === path);
}

export const assetUrl = (path: string) => staticFile(path);

/** A marked placeholder for words or a number not in yet. Drafts only: final refuses earlier. */
export function Marked({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        background: "rgba(255, 201, 77, 0.28)",
        outline: `3px dashed ${colors["flame-deep"]}`,
        outlineOffset: 2,
        borderRadius: 10,
        padding: "0 10px",
        fontFamily: fonts.latin,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Text with its {keys} filled from numbers.json. A null number stays a visible marked {key}, never
 * a guess; a private one reads "kept private"; a TODO line is marked whole.
 */
export function Filled({ text }: { text: string }) {
  const { numbers } = useStory();
  if (isTodo(text)) return <Marked>{text}</Marked>;
  const parts = text.split(/(\{[a-z0-9_]+\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\{([a-z0-9_]+)\}$/);
        if (!m) return <span key={i}>{part}</span>;
        const entry = numbers.numbers[m[1]!];
        if (entry?.hidden) return <span key={i}>(kept private: fewer than 5 teachers)</span>;
        const value = formatNumber(entry);
        return value === null ? <Marked key={i}>{part}</Marked> : <span key={i}>{value}</span>;
      })}
    </>
  );
}
