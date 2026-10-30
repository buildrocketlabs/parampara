import { SPEECH } from "../router";

/** A change of model, speaker, pace or codec is a new voice, so cached audio is never reused across it. */
export const SPEAK_VOICE_ID = `${SPEECH.speak.model}:${SPEECH.speak.speaker}:${SPEECH.speak.pace}:${SPEECH.speak.codec}`;
