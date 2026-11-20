/**
 * penalty-method.test.ts - Brute-force penalized minimizer check, monotone
 * violation, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./penalty-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Brute-force minimizer of the penalized objective on a fine grid. */
function bruteForcePenalized(target: number, bound: number, mu: number): number {
    let bestX = target;
    let best = Infinity;
    for (let k = -2000; k <= 6000; k += 1) {
        const x = k / 1000;
        const value = (x - target) ** 2 + mu * Math.max(0, x - bound) ** 2;
        if (value < best) {
            best = value;
            bestX = x;
        }
    }
    return bestX;
}

describe("Quadratic Penalty Method", () => {
    it("matches a brute-force penalized minimizer at several weights", () => {
        const target = 3;
        const bound = 1;
        for (const mu of [0.5, 1, 4, 10]) {
            const frames = [...mod.run({ target, bound, mu0: mu, growth: 2, iterations: 1 })];
            checkFrames(frames);
            const x = Number(frames[1]!.meta["x"]);
            expect(Math.abs(x - bruteForcePenalized(target, bound, mu))).toBeLessThan(1e-2);
        }
    });

    it("drives the violation toward zero and shrinks it monotonically", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        let prev = Infinity;
        for (const frame of frames) {
            const v = Number(frame.meta["violation"]);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(prev + 1e-12);
            prev = v;
        }
        const last = frames[frames.length - 1]!.meta;
        expect(Number(last["x"])).toBeCloseTo(1, 3);
        expect(Number(last["violation"])).toBeLessThan(1e-3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
