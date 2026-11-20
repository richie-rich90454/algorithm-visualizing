/** leveled-compaction.test.ts - Brute-force latest-write lookup, structural invariants, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { buildLevels, checkInvariants, lookup, type Levels } from "./leveled-compaction";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Leveled Compaction", () => {
    it("returns the latest write for every key across random streams", () => {
        for (let trial = 0; trial < 40; trial += 1) {
            const writes = Array.from({ length: 5 + (trial % 12) }, (_, i) => ({
                key: (i * 3 + trial) % 7,
                value: 100 + i,
            }));
            const levels: Levels = buildLevels(writes, 2, 2);
            const brute = new Map<number, number>();
            writes.forEach((w) => brute.set(w.key, w.value));
            for (const [key, value] of brute) expect(lookup(levels, key)).toBe(value);
            const inv = checkInvariants(levels);
            expect(inv.sorted).toBe(true);
            expect(inv.disjoint).toBe(true);
            expect(inv.unique).toBe(true);
        }
    });

    it("keeps every level within its table threshold", () => {
        for (let trial = 0; trial < 20; trial += 1) {
            const writes = Array.from({ length: 20 }, (_, i) => ({ key: (i * 5 + trial) % 11, value: i }));
            const threshold = 1 + (trial % 4);
            const levels = buildLevels(writes, threshold, 3);
            levels.forEach((level) => expect(level.length).toBeLessThanOrEqual(threshold));
        }
    });

    it("emits well-formed frames and terminates", () => {
        const input = mod.defaultInput as { writes: Array<{ key: number; value: number }>; threshold: number; fileSize: number };
        const generator = mod.run(input);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(final["done"]).toBe(true);
        expect(final["sorted"]).toBe(1);
        expect(final["disjoint"]).toBe(1);
        expect(final["unique"]).toBe(1);
        expect(generator.next().done).toBe(true);
    });
});
