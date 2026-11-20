/** cma-es.test.ts - Brute-force grid cross-check, determinism, frame shape, termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./cma-es";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        expect(frame.entities.some((entity) => entity.id === "mean")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Exhaustive grid minimum of the same bowl objective. */
function gridMinimum(targetX: number, targetY: number, condition: number): number {
    let best = Infinity;
    for (let x = -500; x <= 500; x += 1) {
        for (let y = -500; y <= 500; y += 1) {
            const dx = x / 100 - targetX;
            const dy = y / 100 - targetY;
            best = Math.min(best, dx * dx + condition * dy * dy);
        }
    }
    return best;
}

describe("CMA-ES", () => {
    it("finds the grid-search optimum of a scaled bowl", () => {
        const input = { targetX: 1, targetY: -2, condition: 4, startX: -2, startY: 3, generations: 140, seed: 2026 };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const reference = gridMinimum(1, -2, 4);
        expect(Number(final?.["bestValue"])).toBeLessThanOrEqual(reference + 0.05);
        expect(Number(final?.["bestValue"])).toBeLessThan(30);
        const bestPoint = final?.["bestPoint"] as number[];
        expect(bestPoint[0] ?? 0).toBeCloseTo(1, 0);
        expect(bestPoint[1] ?? 0).toBeCloseTo(-2, 0);
    });

    it("is deterministic for a fixed seed", () => {
        const input = { generations: 40, seed: 77 };
        const first = [...mod.run(input)];
        const second = [...mod.run(input)];
        checkFrames(first);
        expect(first[first.length - 1]?.meta["bestValue"]).toBe(second[second.length - 1]?.meta["bestValue"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(10);
        expect(generator.next().done).toBe(true);
    });
});
