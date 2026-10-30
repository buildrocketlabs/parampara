"use client";

// Hanate says a question aloud: the Bulbul voice when the server has one, else the phone's own
// Kannada voice when it has one, else nothing (the question is always on screen, Law 8).

let current: HTMLAudioElement | null = null;

export function stopSaying() {
  current?.pause();
  current = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function phoneKannadaVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("kn")) ?? null;
}

export type Said = "voice" | "phone" | "none";

export function sayAloud(text: string, url: string | null, onSpeaking: (speaking: boolean) => void): Promise<Said> {
  stopSaying();
  return new Promise((resolve) => {
    const phone = () => {
      const voice = phoneKannadaVoice();
      if (!voice) {
        onSpeaking(false);
        resolve("none");
        return;
      }
      const line = new SpeechSynthesisUtterance(text);
      line.voice = voice;
      line.lang = voice.lang;
      line.rate = 0.9;
      line.onend = () => onSpeaking(false);
      line.onerror = () => onSpeaking(false);
      onSpeaking(true);
      window.speechSynthesis.speak(line);
      resolve("phone");
    };
    if (!url) return phone();
    const audio = new Audio(url);
    current = audio;
    audio.onended = () => onSpeaking(false);
    audio.onerror = () => phone();
    audio
      .play()
      .then(() => {
        onSpeaking(true);
        resolve("voice");
      })
      .catch(() => phone());
  });
}
