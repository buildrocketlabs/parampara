import { LanguageToggle } from "./LanguageToggle";
import { Wordmark } from "./Wordmark";

// The plain header for pages before a session exists (/login, /join): name home, language.
export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
      <Wordmark />
      <LanguageToggle />
    </header>
  );
}
