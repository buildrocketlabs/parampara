import { afterEach, describe, expect, it, vi } from "vitest";
import { levelFromRms, pickMimeType, RecorderError, smoothLevel, startRecording } from "./recorder";

describe("pickMimeType", () => {
  const supports =
    (...types: string[]) =>
    (t: string) =>
      types.includes(t);

  it("prefers webm opus, then mp4, then ogg opus, then the browser default", () => {
    expect(pickMimeType(supports("audio/webm;codecs=opus", "audio/mp4"))).toBe(
      "audio/webm;codecs=opus",
    );
    expect(pickMimeType(supports("audio/mp4"))).toBe("audio/mp4"); // Safari
    expect(pickMimeType(supports("audio/ogg;codecs=opus"))).toBe("audio/ogg;codecs=opus");
    expect(pickMimeType(supports())).toBe("");
    expect(
      pickMimeType((t) => {
        if (t.startsWith("audio/webm")) throw new Error("NotSupportedError");
        return t === "audio/mp4";
      }),
    ).toBe("audio/mp4");
  });
});

describe("level", () => {
  it("maps -60 dBFS to 0, -10 dBFS to 1, and rises faster than it falls", () => {
    expect(levelFromRms(0)).toBe(0);
    expect(levelFromRms(10 ** (-60 / 20))).toBeCloseTo(0, 6);
    expect(levelFromRms(10 ** (-35 / 20))).toBeCloseTo(0.5, 6);
    expect(levelFromRms(1)).toBe(1);
    const up = smoothLevel(0, 1);
    const down = 1 - smoothLevel(1, 0);
    expect(up).toBeGreaterThan(down);
  });
});

describe("startRecording", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubMicrophone(getUserMedia: () => Promise<unknown>) {
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  }

  class FakeRecorder extends EventTarget {
    static isTypeSupported = (t: string) => t === "audio/mp4";
    state: "inactive" | "recording" = "inactive";
    mimeType: string;
    constructor(_stream: unknown, options?: { mimeType?: string }) {
      super();
      this.mimeType = options?.mimeType ?? "";
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      queueMicrotask(() => {
        const data = new Blob(["voice"], { type: this.mimeType });
        this.dispatchEvent(Object.assign(new Event("dataavailable"), { data }));
        this.dispatchEvent(new Event("stop"));
      });
    }
  }

  function stubWorkingMicrophone() {
    const track = { stop: vi.fn() };
    stubMicrophone(async () => ({ getTracks: () => [track] }));
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    return track;
  }

  async function kindOf(promise: Promise<unknown>) {
    try {
      await promise;
      return "started";
    } catch (err) {
      return err instanceof RecorderError ? err.kind : String(err);
    }
  }

  it("names the reason it cannot record", async () => {
    vi.stubGlobal("navigator", {});
    expect(await kindOf(startRecording())).toBe("unsupported");

    vi.stubGlobal("MediaRecorder", FakeRecorder);
    stubMicrophone(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
    expect(await kindOf(startRecording())).toBe("permission_denied");
    stubMicrophone(() => Promise.reject(new DOMException("none", "NotFoundError")));
    expect(await kindOf(startRecording())).toBe("no_microphone");
  });

  it("records in the preferred format and releases the microphone on stop", async () => {
    const track = stubWorkingMicrophone();
    const recording = await startRecording();
    expect(recording.mimeType).toBe("audio/mp4");
    const blob = await recording.stop();
    expect(blob.size).toBe(5);
    expect(blob.type).toBe("audio/mp4");
    expect(track.stop).toHaveBeenCalled();
    expect(await recording.stop()).toBe(blob); // a second stop returns the same recording
  });

  it("discards the recording on cancel", async () => {
    const track = stubWorkingMicrophone();
    const recording = await startRecording();
    recording.cancel();
    expect((await recording.stop()).size).toBe(0);
    expect(track.stop).toHaveBeenCalled();
  });

  it("stops by itself at maxMs and tells the caller", async () => {
    stubWorkingMicrophone();
    const onMaxReached = vi.fn();
    const recording = await startRecording({ maxMs: 5, onMaxReached });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onMaxReached).toHaveBeenCalledOnce();
    expect((await recording.stop()).size).toBe(5);
  });
});
