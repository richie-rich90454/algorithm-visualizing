/**
 * projected-gradient.test.ts - Brute-force optimum check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./projected-gradient";
import type { VisualFrame } from "@/types";

function objective(x: number, y: number): number {
    return (x - 3) * (x - 3) + (y + 1) * (y + 1);
}

/** Brute-force grid search over the feasible box, used as an oracle. */
function bruteForceBest(lower: number, upper: number): number {
    let best = Number.POSITIVE_INFINITY;
    const steps = 200;
    for (let i = 0; i <= steps; i += 1) {
        const x = lower + ((upper - lower) * i) / steps;
        for (let j = 0; j <= steps; j += 1) {
            const y = lower + ((upper - lower) * j) / steps;
            best = Math.min(best, objective(x, y));
        }
    }
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Projected Gradient Descent", () => {
    it("finds a near-optimal feasible point confirmed by brute force", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        const x = Number(last?.["x"]);
        const y = Number(last?.["y"]);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(2);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(2);
        expect(x).toBeCloseTo(2, 3);
        expect(y).toBeCloseTo(0, 3);
        expect(Number(last?.["f"])).toBeLessThanOrEqual(bruteForceBest(0, 2) + 1e-4);
    });

    it("keeps every iterate inside the box", () => {
        const frames = [...mod.run({ x0: -1, y0: 3, step: 0.2, iterations: 40 })];
        for (const frame of frames.slice(1)) {
            const x = Number(frame.meta["x"]);
            const y = Number(frame.meta["y"]);
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(2);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(2);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
