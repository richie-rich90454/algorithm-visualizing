/** beta-binomial.test.ts - Independent rising-factorial check and frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./beta-binomial";
import type { VisualFrame } from "@/types";

/** Rising factorial (a)_m, computed as an explicit product. */
function rising(a: number, m: number): number {
    let value = 1;
    for (let i = 0; i < m; i += 1) value *= a + i;
    return value;
}

/** Independent closed form using rising factorials rather than log gamma. */
function reference(n: number, a: number, b: number): number[] {
    const denominator = rising(a + b, n);
    return Array.from({ length: n + 1 }, (_, k) =>
        (rising(1, n) / (rising(1, k) * rising(1, n - k))
            * rising(a, k) * rising(b, n - k)) / denominator);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    });
}

describe("Beta-Binomial", () => {
    it("matches an independent rising-factorial reference across parameter sets", () => {
        const cases = [
            { n: 8, a: 2, b: 3 },
            { n: 12, a: 1.5, b: 2.5 },
            { n: 6, a: 4, b: 1 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const expected = reference(input.n, input.a, input.b);
            const actual = final["pmf"] as number[];
            expect(actual.length).toBe(expected.length);
            for (let k = 0; k < expected.length; k += 1) {
                expect(Math.abs((actual[k] ?? 0) - (expected[k] ?? 0))).toBeLessThan(1e-9);
            }
            expect(Number(final["total"])).toBeCloseTo(1, 9);
            expect(Number(final["mean"])).toBeCloseTo((input.n * input.a) / (input.a + input.b), 9);
        }
    });

    it("keeps the mean and variance identities for several inputs", () => {
        for (let a = 1; a <= 4; a += 1) {
            for (let b = 1; b <= 4; b += 1) {
                const frames = [...mod.run({ n: 9, a, b })];
                const final = frames[frames.length - 1]!.meta;
                const pmf = final["pmf"] as number[];
                const mean = pmf.reduce((sum, p, k) => sum + k * p, 0);
                const variance = pmf.reduce((sum, p, k) => sum + (k - mean) ** 2 * p, 0);
                expect(Number(final["mean"])).toBeCloseTo(mean, 8);
                expect(Number(final["variance"])).toBeCloseTo(variance, 6);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
