/**
 * chernoff-bound.test.ts - Independent binomial tails, closed-form bound
 * verification, dominance, monotonicity, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./chernoff-bound";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], trials: number): void {
    expect(frames.length).toBe(trials + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(trials + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["trials"]).toBe(trials);
    });
}

function factorial(n: number): number {
    let result = 1;
    for (let i = 2; i <= n; i += 1) {
        result *= i;
    }
    return result;
}

/** Reference tails using the factorial definition of the binomial coefficient. */
function referenceTails(n: number, p: number): { upper: number[]; lower: number[] } {
    const pmf = Array.from({ length: n + 1 }, (_, j) =>
        (factorial(n) / (factorial(j) * factorial(n - j))) * p ** j * (1 - p) ** (n - j));
    const upper: number[] = [];
    const lower: number[] = [];
    for (let k = 0; k <= n; k += 1) {
        upper.push(pmf.slice(k).reduce((a, b) => a + b, 0));
        lower.push(pmf.slice(0, k + 1).reduce((a, b) => a + b, 0));
    }
    return { upper, lower };
}

function referenceBound(n: number, p: number, k: number): number {
    const mu = n * p;
    if (k > mu) {
        const delta = k / mu - 1;
        return Math.exp((-mu * delta * delta) / (2 + delta));
    }
    if (k < mu) {
        const delta = 1 - k / mu;
        return Math.exp((-mu * delta * delta) / 2);
    }
    return 1;
}

describe("ChernoffBound", () => {
    it("matches independently computed binomial tails and bound formulas", () => {
        const input = mod.defaultInput as { trials: number; probability: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.trials);
        const meta = frames[frames.length - 1]!.meta;
        const expected = referenceTails(input.trials, input.probability);
        expect(meta["mu"]).toBeCloseTo(input.trials * input.probability, 12);
        const upper = meta["exactUpper"] as number[];
        const lower = meta["exactLower"] as number[];
        const bounds = meta["bound"] as number[];
        for (let k = 0; k <= input.trials; k += 1) {
            expect(upper[k]).toBeCloseTo(expected.upper[k]!, 10);
            expect(lower[k]).toBeCloseTo(expected.lower[k]!, 10);
            expect(bounds[k]).toBeCloseTo(referenceBound(input.trials, input.probability, k), 10);
        }
    });

    it("keeps every bound above the exact tail in both directions", () => {
        for (const [trials, p] of [[10, 0.4], [12, 0.25], [8, 0.7]] as Array<[number, number]>) {
            const frames = [...mod.run({ trials, probability: p })];
            checkFrames(frames, trials);
            const meta = frames[frames.length - 1]!.meta;
            const bounds = meta["bound"] as number[];
            const upper = meta["exactUpper"] as number[];
            const lower = meta["exactLower"] as number[];
            const sides = meta["tailSide"] as string[];
            for (let k = 0; k <= trials; k += 1) {
                const exact = sides[k] === "upper" ? upper[k]! : lower[k]!;
                expect(bounds[k]!).toBeGreaterThanOrEqual(exact - 1e-12);
            }
        }
    });

    it("has monotone exact tails and a decaying upper bound", () => {
        const frames = [...mod.run({ trials: 20, probability: 0.5 })];
        checkFrames(frames, 20);
        const meta = frames[frames.length - 1]!.meta;
        const upper = meta["exactUpper"] as number[];
        const lower = meta["exactLower"] as number[];
        const bounds = meta["bound"] as number[];
        for (let k = 1; k <= 20; k += 1) {
            expect(upper[k]!).toBeLessThanOrEqual(upper[k - 1]! + 1e-12);
            expect(lower[k]!).toBeGreaterThanOrEqual(lower[k - 1]! - 1e-12);
        }
        for (let k = 11; k <= 20; k += 1) {
            expect(bounds[k]!).toBeLessThan(bounds[k - 1]!);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(13);
        expect(generator.next().done).toBe(true);
    });
});
