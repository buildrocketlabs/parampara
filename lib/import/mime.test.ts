import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isOggName, looksLikeAudio, STORABLE_MIME, storableMime } from "./mime";

describe("storableMime", () => {
  it("stores a WhatsApp .opus as audio/ogg whatever the browser said", () => {
    for (const type of ["", "audio/opus", "audio/ogg; codecs=opus", "application/x-opus"]) {
      expect(storableMime({ name: "PTT-20261028-WA0003.opus", type })).toBe("audio/ogg");
    }
  });

  it("maps the other extensions a phone gives", () => {
    expect(storableMime({ name: "a.m4a", type: "audio/x-m4a" })).toBe("audio/mp4");
    expect(storableMime({ name: "a.MP3", type: "" })).toBe("audio/mpeg");
    expect(storableMime({ name: "a.amr", type: "" })).toBe("audio/amr");
  });

  it("falls back to the browser's type without parameters, or to octet-stream", () => {
    expect(storableMime({ name: "voice", type: "audio/ogg; codecs=opus" })).toBe("audio/ogg");
    expect(storableMime({ name: "voice", type: "audio/x-weird" })).toBe("application/octet-stream");
    expect(storableMime({ name: "voice", type: "" })).toBe("application/octet-stream");
  });

  it("only ever returns a type the interviews bucket allows", () => {
    const sql = readFileSync("supabase/migrations/0002_storage.sql", "utf8");
    const list = /\('interviews'[^\]]*\]/.exec(sql)![0];
    const allowed = [...list.matchAll(/'([a-z0-9-]+\/[a-z0-9.+-]+)'/g)].map((m) => m[1]);
    expect(new Set(allowed)).toEqual(STORABLE_MIME);
    for (const name of ["a.opus", "a.ogg", "a.oga", "a.m4a", "a.wav", "a.webm", "a.3gp", "a.x"]) {
      expect(STORABLE_MIME.has(storableMime({ name, type: "" }))).toBe(true);
    }
  });
});

describe("looksLikeAudio", () => {
  it("accepts voice notes with an empty type and refuses a chat's text file", () => {
    expect(looksLikeAudio({ name: "PTT-20261028-WA0003.opus", type: "" })).toBe(true);
    expect(looksLikeAudio({ name: "WhatsApp Chat with Mahesh.txt", type: "text/plain" })).toBe(
      false,
    );
    expect(looksLikeAudio({ name: "IMG-20261028-WA0001.jpg", type: "image/jpeg" })).toBe(false);
    expect(looksLikeAudio({ name: "voice", type: "" })).toBe(true);
  });
});

describe("isOggName", () => {
  it("knows WhatsApp's notes", () => {
    expect(isOggName({ name: "a.opus", type: "" })).toBe(true);
    expect(isOggName({ name: "a", type: "audio/ogg; codecs=opus" })).toBe(true);
    expect(isOggName({ name: "a.m4a", type: "audio/mp4" })).toBe(false);
  });
});
