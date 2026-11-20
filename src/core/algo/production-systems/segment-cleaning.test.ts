/** segment-cleaning.test.ts - Greedy reference, cost-benefit properties, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./segment-cleaning";
import type { VisualFrame } from "@/types";

interface Segment {
    id: number;
    live: number;
    total: number;
}

function reference(segments: Segment[], k: number) {
    const ranked = segments
        .map((s) => {
            const total = Math.max(0, Math.floor(s.total));
            const live = Math.max(0, Math.min(total, Math.floor(s.live)));
            const free = total - live;
            return { id: s.id, live, free, score: live === 0 ? Number.POSITIVE_INFINITY : free / live };
        })
        .sort((a, b) => b.score - a.score || a.id - b.id);
    const chosen = ranked.slice(0, k);
    return {
        chosen: chosen.map((c) => c.id),
        reclaimed: chosen.reduce((sum, c) => sum + c.free, 0),
        copied: chosen.reduce((sum, c) => sum + c.live, 0),
    };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("segment-cleaning", () => {
    it("matches an independent greedy ranking", () => {
        const input = mod.defaultInput as { segments: Segment[]; maxSegments: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.segments, input.maxSegments);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["chosen"]).toEqual(expected.chosen);
        expect(final?.["reclaimed"]).toBe(expected.reclaimed);
        expect(final?.["copied"]).toBe(expected.copied);
    });

    it("prefers a dead segment and breaks ties by id", () => {
        const segments: Segment[] = [
            { id: 9, live: 50, total: 50 },
            { id: 2, live: 0, total: 40 },
            { id: 5, live: 50, total: 100 },
            { id: 1, live: 50, total: 100 },
        ];
        const frames = [...mod.run({ segments, maxSegments: 2 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["chosen"]).toEqual([2, 1]);
        expect(final?.["reclaimed"]).toBe(90);
        expect(final?.["copied"]).toBe(50);
    });

    it("never selects more segments than the budget", () => {
        const segments: Segment[] = [{ id: 0, live: 1, total: 10 }];
        const frames = [...mod.run({ segments, maxSegments: 0 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["chosen"]).toEqual([]);
        expect(final?.["reclaimed"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
