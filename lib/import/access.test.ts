import { describe, expect, it } from "vitest";
import { fixtureSession } from "@/lib/auth/session";
import { canImportFor, maxImportMs } from "./access";

const fieldMaster = { id: "m-field", profileId: "p-field", isSample: false };
const sampleMaster = { id: "m-sample", profileId: "fixture-master", isSample: true };

describe("import access (D38)", () => {
  it("a field reviewer imports for any master", () => {
    const reviewer = { ...fixtureSession("reviewer"), isSample: false };
    expect(canImportFor(reviewer, fieldMaster)).toBe(true);
    expect(canImportFor(reviewer, sampleMaster)).toBe(true);
  });

  it("a demo reviewer imports only for sample masters, with a short cap", () => {
    const demo = fixtureSession("reviewer");
    expect(canImportFor(demo, fieldMaster)).toBe(false);
    expect(canImportFor(demo, sampleMaster)).toBe(true);
    expect(maxImportMs(demo)).toBe(10 * 60_000);
  });

  it("a master imports only for themselves; teachers and officers never", () => {
    const master = fixtureSession("master");
    expect(canImportFor(master, sampleMaster)).toBe(true);
    expect(canImportFor(master, { ...sampleMaster, profileId: "someone-else" })).toBe(false);
    expect(canImportFor(fixtureSession("teacher"), sampleMaster)).toBe(false);
    expect(canImportFor(fixtureSession("officer"), sampleMaster)).toBe(false);
  });
});
