/**
 * cache-replacement-arc.test.ts - Structural invariants, hit accounting,
 * promotion behavior, scan adaptivity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cache-replacement-arc";
import type { VisualFrame } from "@/types";

interface Meta {
    t1: string[];
    t2: string[];
    b1: string[];
    b2: string[];
    p: number;
    hits: number;
    misses: number;
}

function checkFrames(frames: VisualFrame[], keys: string[], capacity: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(keys.length);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(keys.length);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const meta = frame.meta as unknown as Meta;
        expect(meta.t1.length + meta.t2.length).toBeLessThanOrEqual(capacity);
        expect(meta.b1.length).toBeLessThanOrEqual(capacity);
        expect(meta.b2.length).toBeLessThanOrEqual(capacity);
        expect(meta.p).toBeGreaterThanOrEqual(0);
        expect(meta.p).toBeLessThanOrEqual(capacity);
        const all = [...meta.t1, ...meta.t2, ...meta.b1, ...meta.b2];
        expect(new Set(all).size).toBe(all.length);
    });
}

function finalMeta(frames: VisualFrame[]): Meta {
    return frames[frames.length - 1]?.meta as unknown as Meta;
}

describe("CacheReplacementARC", () => {
    it("maintains ARC invariants over varied workloads", () => {
        const cases: Array<{ references: string[]; capacity: number }> = [
            { references: ["A", "B", "C", "A", "D", "B", "E", "C", "A", "B", "C", "D"], capacity: 3 },
            { references: ["X", "Y", "X", "Z", "Y", "X", "W", "Z"], capacity: 2 },
            { references: Array.from({ length: 50 }, (_, i) => String.fromCharCode(65 + (i % 6))), capacity: 4 },
            { references: ["only", "only", "only"], capacity: 1 },
        ];
        for (const testCase of cases) {
            const keys = [...new Set(testCase.references)];
            const frames = [...mod.run(testCase)];
            checkFrames(frames, keys, testCase.capacity);
            const meta = finalMeta(frames);
            expect(meta.hits + meta.misses).toBe(testCase.references.length);
        }
    });

    it("promotes a twice-seen page into T2", () => {
        const frames = [...mod.run({ references: ["A", "B", "A"], capacity: 2 })];
        const meta = finalMeta(frames);
        expect(meta.t2).toContain("A");
        expect(meta.t1).not.toContain("A");
        expect(meta.hits).toBe(1);
    });

    it("adapts the target upward on repeated ghost hits", () => {
        const references = ["A", "B", "C", "D", "A", "B"];
        const frames = [...mod.run({ references, capacity: 3 })];
        checkFrames(frames, [...new Set(references)], 3);
        const meta = finalMeta(frames);
        expect(meta.p).toBeGreaterThan(0);
        expect(meta.hits + meta.misses).toBe(references.length);
    });

    it("keeps a single-slot cache correct", () => {
        const frames = [...mod.run({ references: ["A", "B", "A", "B", "A"], capacity: 1 })];
        checkFrames(frames, ["A", "B"], 1);
        const meta = finalMeta(frames);
        expect(meta.t1.length + meta.t2.length).toBeLessThanOrEqual(1);
        expect(meta.hits + meta.misses).toBe(5);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(14);
        expect(generator.next().done).toBe(true);
    });
});
