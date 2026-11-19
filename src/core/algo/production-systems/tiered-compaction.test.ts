/**
 * tiered-compaction.test.ts - Key preservation and merge-count checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./tiered-compaction";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["family"]).toBe("tiered-compaction");
    });
}

/** Independent size-tiered compaction simulation. */
function reference(tables: number[][], threshold: number) {
    let live = tables.map((t) => [...t].sort((a, b) => a - b));
    let merges = 0;
    for (let guard = 0; guard < 100; guard += 1) {
        const groups = new Map<number, number[]>();
        live.forEach((table, i) => {
            const g = groups.get(table.length) ?? [];
            g.push(i);
            groups.set(table.length, g);
        });
        const ready = [...groups.entries()].filter(([, idx]) => idx.length >= threshold).map(([size]) => size).sort((a, b) => a - b);
        if (!ready.length) break;
        const idx = groups.get(ready[0]!)!.slice(0, threshold);
        const combined = idx.flatMap((i) => live[i]!).sort((a, b) => a - b);
        const merged = combined.filter((v, i) => i === 0 || v !== combined[i - 1]);
        const removed = new Set(idx);
        live = live.filter((_, i) => !removed.has(i));
        live.push(merged);
        merges += 1;
    }
    return { sizes: live.map((t) => t.length), keys: [...new Set(live.flat())].sort((a, b) => a - b), merges };
}

describe("Tiered Compaction", () => {
    it("preserves every key and matches an independent compaction run", () => {
        const tables: number[][] = [[1], [2], [3], [4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14, 15], [16, 17, 18], [19, 20, 21], [22, 23, 24]];
        const frames = [...mod.run({ tables, threshold: 4 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const expected = reference(tables, 4);
        expect(meta?.["allKeys"]).toEqual(expected.keys);
        expect(meta?.["sizes"]).toEqual(expected.sizes);
        expect(meta?.["merges"]).toBe(expected.merges);
        expect(meta?.["tableCount"]).toBeLessThan(tables.length);
        expect([...new Set(tables.flat())].sort((a, b) => a - b)).toEqual(expected.keys);
    });

    it("does nothing when no tier reaches the threshold", () => {
        const tables = [[1, 2], [3, 4], [5, 6, 7]];
        const frames = [...mod.run({ tables, threshold: 4 })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["merges"]).toBe(0);
        expect(meta?.["tableCount"]).toBe(3);
        expect(meta?.["allKeys"]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
