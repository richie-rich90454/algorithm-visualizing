import { describe, expect, it } from "vitest";
import mod from "./pade-approximant";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.metadata["row"] !== undefined && e.metadata["col"] !== undefined)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

// Independent exact rational check of the Padé matching conditions.
function series(upTo: number): number[] {
    const out = [1];
    let fact = 1;
    for (let k = 1; k <= upTo; k += 1) {
        fact *= k;
        out.push(1 / fact);
    }
    return out;
}

describe("Padé Approximant", () => {
    it("matches the exponential series through order m+n for many orders", () => {
        for (let m = 1; m <= 4; m += 1) {
            for (let n = 1; n <= 4; n += 1) {
                const frames = [...mod.run({ m, n })];
                checkFrames(frames);
                const meta = frames[frames.length - 1]?.meta as {
                    numerator: number[];
                    denominator: number[];
                    maxMismatch: number;
                };
                const p = meta.numerator;
                const q = meta.denominator;
                expect(q[0]).toBeCloseTo(1, 12);
                const c = series(m + n);
                for (let k = 0; k <= m + n; k += 1) {
                    let convolution = 0;
                    for (let j = 0; j <= Math.min(k, n); j += 1) {
                        convolution += (q[j] ?? 0) * (c[k - j] ?? 0);
                    }
                    const expected = k <= m ? (p[k] ?? 0) : 0;
                    expect(Math.abs(convolution - expected)).toBeLessThan(1e-9);
                }
                expect(Number(meta.maxMismatch)).toBeLessThan(1e-9);
            }
        }
    });

    it("produces the textbook [2/2] exponential approximant", () => {
        const frames = [...mod.run({ m: 2, n: 2 })];
        const meta = frames[frames.length - 1]?.meta as { numerator: number[]; denominator: number[] };
        expect(meta.numerator[0]).toBeCloseTo(1, 10);
        expect(meta.numerator[1]).toBeCloseTo(0.5, 10);
        expect(meta.numerator[2]).toBeCloseTo(1 / 12, 10);
        expect(meta.denominator[1]).toBeCloseTo(-0.5, 10);
        expect(meta.denominator[2]).toBeCloseTo(1 / 12, 10);
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
