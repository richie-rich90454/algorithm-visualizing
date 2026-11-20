/** skip-scan-index.test.ts - Brute-force slot scan cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./skip-scan-index";
import type { VisualFrame } from "@/types";

interface Entry { slot: number; value: string }

function bruteForce(entries: Entry[], cursor: number, count: number, prefix: string, maxSlot: number): { examined: number[]; results: string[]; cursor: number } {
    const bySlot = new Map(entries.map((e) => [e.slot, e.value]));
    const examined: number[] = [];
    const results: string[] = [];
    let pos = cursor;
    let guard = 0;
    const limit = (maxSlot + 1) * 3;
    while (examined.length < count && guard < limit) {
        guard += 1;
        const value = bySlot.get(pos);
        if (value !== undefined) {
            examined.push(pos);
            if (prefix === "" || value.startsWith(prefix)) { results.push(`${pos}:${value}`); }
        }
        pos = pos >= maxSlot ? 0 : pos + 1;
    }
    return { examined, results, cursor: pos };
}

function checkFrames(frames: VisualFrame[], count: number, maxSlot: number): void {
    expect(frames.length).toBe(count + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(maxSlot + 1);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("SkipScanIndex", () => {
    it("matches a brute-force slot scan", () => {
        const entries: Entry[] = [
            { slot: 1, value: "apple" }, { slot: 4, value: "apricot" }, { slot: 7, value: "banana" },
            { slot: 9, value: "avocado" }, { slot: 12, value: "cherry" },
        ];
        for (const input of [
            { cursor: 0, count: 3, prefix: "" },
            { cursor: 2, count: 4, prefix: "a" },
            { cursor: 10, count: 3, prefix: "" },
        ]) {
            const maxSlot = 12;
            const expected = bruteForce(entries, input.cursor, input.count, input.prefix, maxSlot);
            const frames = [...mod.run({ entries, maxSlot, ...input })];
            checkFrames(frames, input.count, maxSlot);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["examined"]).toEqual(expected.examined);
            expect(final?.["results"]).toEqual(expected.results);
            expect(final?.["cursor"]).toBe(expected.cursor);
        }
    });

    it("agrees with brute force on random sparse indexes", () => {
        let seed = 43;
        for (let trial = 0; trial < 20; trial += 1) {
            const maxSlot = 15;
            const entries: Entry[] = [];
            for (let slot = 0; slot <= maxSlot; slot += 1) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                if (seed % 3 === 0) { entries.push({ slot, value: seed % 2 === 0 ? "alpha" : "beta" }); }
            }
            if (entries.length === 0) { entries.push({ slot: 3, value: "alpha" }); }
            const cursor = seed % (maxSlot + 1);
            const count = 1 + (trial % 5);
            const prefix = trial % 2 === 0 ? "a" : "";
            const expected = bruteForce(entries, cursor, count, prefix, maxSlot);
            const frames = [...mod.run({ entries, maxSlot, cursor, count, prefix })];
            checkFrames(frames, count, maxSlot);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["examined"]).toEqual(expected.examined);
            expect(final?.["results"]).toEqual(expected.results);
            expect(final?.["cursor"]).toBe(expected.cursor);
            expect(final?.["cursor"] as number).toBeGreaterThanOrEqual(0);
            expect(final?.["cursor"] as number).toBeLessThanOrEqual(maxSlot);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
