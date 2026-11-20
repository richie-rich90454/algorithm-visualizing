/**
 * remez-algorithm.test.ts - Minimax approximation correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./remez-algorithm";
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
    });
}

/** Brute-force minimax error: scan slopes and best-fit the intercept. */
function bruteMinimaxError(): number {
    let best = Number.POSITIVE_INFINITY;
    for (let a = 1; a <= Math.E + 0.01; a += 0.0005) {
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        for (let i = 0; i <= 2000; i += 1) {
            const x = i / 2000;
            const diff = Math.exp(x) - a * x;
            min = Math.min(min, diff);
            max = Math.max(max, diff);
        }
        const err = (max - min) / 2;
        best = Math.min(best, err);
    }
    return best;
}

describe("Remez Exchange", () => {
    it("equioscillates with equal magnitude at three points", () => {
        const frames = [...mod.run({ iterations: 12 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const errors = final?.["errors"] as number[];
        const E = Number(final?.["E"]);
        expect(errors.length).toBe(3);
        expect(Math.sign(errors[0] as number)).toBe(1);
        expect(Math.sign(errors[1] as number)).toBe(-1);
        expect(Math.sign(errors[2] as number)).toBe(1);
        errors.forEach((err) => expect(Math.abs(Math.abs(err) - E)).toBeLessThan(1e-6));
    });

    it("matches a brute-force scan for the smallest possible error", () => {
        const frames = [...mod.run({ iterations: 12 })];
        const final = frames[frames.length - 1]?.meta;
        const E = Number(final?.["E"]);
        const gridMax = Number(final?.["gridMax"]);
        const brute = bruteMinimaxError();
        expect(Math.abs(E - brute)).toBeLessThan(1e-4);
        expect(Math.abs(gridMax - E)).toBeLessThan(1e-5);
    });

    it("reports convergence for the default input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames[frames.length - 1]?.meta["converged"]).toBe(true);
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
