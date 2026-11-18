/**
 * quadratic-probing.test.ts - Independent table simulation and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { hashKey, probeSlot } from "./quadratic-probing";
import type { VisualFrame } from "@/types";

function hash(key: string, size: number): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % size;
  return h;
}

function reference(keys: string[], size: number): Array<string | null> {
  const table: Array<string | null> = new Array<string | null>(size).fill(null);
  for (const key of keys) {
    const home = hash(key, size);
    for (let k = 0; k < size; k += 1) {
      const slot = (home + k * k) % size;
      if (table[slot] === null) {
        table[slot] = key;
        break;
      }
    }
  }
  return table;
}

function checkFrames(frames: VisualFrame[], size: number): void {
  expect(frames.length).toBeGreaterThan(1);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("grid");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.entities.length).toBe(size);
    expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
    expect(frame.entities.every((e) => e.metadata.row === 0)).toBe(true);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
}

describe("Quadratic probing", () => {
  const input = { keys: ["cat", "car", "dog", "cow", "bat"], size: 11, probe: "dog" };

  it("builds the same table as an independent reference simulation", () => {
    const frames = [...mod.run(input)];
    checkFrames(frames, input.size);
    const expected = reference(input.keys, input.size);
    const meta = frames[frames.length - 1]?.meta;
    expect(meta?.["table"] as string[]).toEqual(expected.map((v) => v ?? ""));
    const placed = (meta?.["table"] as string[]).filter((v) => v !== "");
    expect(placed.length).toBe(input.keys.length);
    expect(new Set(placed).size).toBe(placed.length);
  });

  it("uses the exact quadratic probe sequence at every step", () => {
    const frames = [...mod.run(input)];
    const insertFrames = frames.filter((f) => f.meta["phase"] === "insert" && f.meta["k"] !== undefined);
    expect(insertFrames.length).toBeGreaterThan(0);
    for (const frame of insertFrames) {
      const home = frame.meta["home"] as number;
      const k = frame.meta["k"] as number;
      const slot = frame.meta["slot"] as number;
      expect(slot).toBe((home + k * k) % input.size);
      expect(hash(frame.meta["key"] as string, input.size)).toBe(home);
      expect(hashKey(frame.meta["key"] as string, input.size)).toBe(home);
      expect(probeSlot(home, k, input.size)).toBe(slot);
    }
  });

  it("finds inserted keys and rejects an absent key", () => {
    for (const key of input.keys) {
      const frames = [...mod.run({ ...input, probe: key })];
      expect(frames[frames.length - 1]?.meta["found"]).toBe(true);
    }
    const missing = [...mod.run({ ...input, probe: "zebra" })];
    expect(missing[missing.length - 1]?.meta["found"]).toBe(false);
  });

  it("reports the probe count from the lookup phase", () => {
    const frames = [...mod.run(input)];
    const lookupFrames = frames.filter((f) => f.meta["phase"] === "lookup");
    const finalProbes = frames[frames.length - 1]?.meta["probes"] as number;
    expect(finalProbes).toBe(lookupFrames.length);
    expect(finalProbes).toBeGreaterThan(0);
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
