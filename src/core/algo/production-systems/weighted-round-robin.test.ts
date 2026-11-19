/**
 * weighted-round-robin.test.ts - Proportionality, interleaving, frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./weighted-round-robin";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], servers: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(servers);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["family"]).toBe("weighted-round-robin");
    });
}

/** Independent smooth weighted round robin reference. */
function reference(weights: number[], requests: number): number[] {
    const scores = weights.map(() => 0);
    const total = weights.reduce((a, b) => a + b, 0);
    const picks: number[] = [];
    for (let r = 0; r < requests; r += 1) {
        let best = 0;
        for (let i = 0; i < weights.length; i += 1) {
            scores[i] = scores[i]! + weights[i]!;
            if (scores[i]! > scores[best]!) best = i;
        }
        scores[best] = scores[best]! - total;
        picks.push(best);
    }
    return picks;
}

describe("Weighted Round Robin", () => {
    it("matches an independent schedule and is exact over full cycles", () => {
        const weights = [3, 1, 2];
        const total = weights.reduce((a, b) => a + b, 0);
        const requests = total * 3;
        const frames = [...mod.run({ weights, requests })];
        checkFrames(frames, weights.length);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["selected"]).toEqual(reference(weights, requests));
        expect(meta?.["counts"]).toEqual([9, 3, 6]);
        expect(meta?.["exact"]).toBe(true);
    });

    it("stays proportional with uneven weights", () => {
        const weights = [5, 2, 2, 1];
        const total = weights.reduce((a, b) => a + b, 0);
        const frames = [...mod.run({ weights, requests: total * 2 })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["counts"]).toEqual(weights.map((w) => w * 2));
        expect(meta?.["exact"]).toBe(true);
        const selected = meta?.["selected"] as number[];
        expect(new Set(selected.slice(0, total)).size).toBeGreaterThan(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
