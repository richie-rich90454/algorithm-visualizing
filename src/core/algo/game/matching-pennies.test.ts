/**
 * matching-pennies.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./matching-pennies";
import type { VisualFrame } from "@/types";

const PAY = [
    [1, -1],
    [-1, 1],
];

/** Row payoff under mixed strategies (p for row, q for column). */
function payoff(p: number, q: number): number {
    return (
        p * q * (PAY[0]?.[0] ?? 0) +
        p * (1 - q) * (PAY[0]?.[1] ?? 0) +
        (1 - p) * q * (PAY[1]?.[0] ?? 0) +
        (1 - p) * (1 - q) * (PAY[1]?.[1] ?? 0)
    );
}

/** Brute-force pure equilibrium enumeration, independent of the module. */
function brutePure(): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
            const row = PAY[i]?.[j] ?? 0;
            const altRow = PAY[1 - i]?.[j] ?? 0;
            const col = -row;
            const altCol = -(PAY[i]?.[1 - j] ?? 0);
            if (row >= altRow && col >= altCol) {
                out.push([i, j]);
            }
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(2);
    });
}

describe("Matching Pennies", () => {
    it("has no pure equilibrium and a half-half mixed saddle point", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(brutePure().length).toBe(0);

        const final = frames[frames.length - 1]?.meta;
        const p = Number(final?.["p"]);
        const q = Number(final?.["q"]);
        const value = Number(final?.["value"]);
        expect(p).toBeCloseTo(0.5, 10);
        expect(q).toBeCloseTo(0.5, 10);
        expect(value).toBeCloseTo(0, 10);

        // Saddle point: deviations in p cannot raise the row payoff, and
        // deviations in q cannot lower it, at the computed equilibrium.
        for (let k = 0; k <= 20; k += 1) {
            const s = k / 20;
            expect(payoff(s, q)).toBeLessThanOrEqual(value + 1e-10);
            expect(payoff(p, s)).toBeGreaterThanOrEqual(value - 1e-10);
        }
    });

    it("matches a brute-force minimax grid search", () => {
        let lower = -Infinity;
        for (let pi = 0; pi <= 100; pi += 1) {
            const p = pi / 100;
            let worst = Infinity;
            for (let qi = 0; qi <= 100; qi += 1) {
                worst = Math.min(worst, payoff(p, qi / 100));
            }
            lower = Math.max(lower, worst);
        }
        expect(lower).toBeCloseTo(0, 6);
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
