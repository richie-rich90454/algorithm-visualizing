/** irwin-hall-distribution.test.ts - brute-force inclusion-exclusion pdf/cdf, integration, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./irwin-hall-distribution";
import type { VisualFrame } from "@/types";

function factorial(n: number): number {
    let r = 1;
    for (let i = 2; i <= n; i += 1) r *= i;
    return r;
}
function choose(n: number, k: number): number {
    let r = 1;
    for (let i = 1; i <= k; i += 1) r = (r * (n - i + 1)) / i;
    return r;
}
function refPdf(x: number, n: number): number {
    if (x < 0 || x > n) return 0;
    let s = 0;
    for (let k = 0; k <= Math.floor(x) && k <= n; k += 1) s += (k % 2 ? -1 : 1) * choose(n, k) * (x - k) ** (n - 1);
    return s / factorial(n - 1);
}
function refCdf(x: number, n: number): number {
    if (x <= 0) return 0;
    if (x >= n) return 1;
    let s = 0;
    for (let k = 0; k <= Math.floor(x) && k <= n; k += 1) s += (k % 2 ? -1 : 1) * choose(n, k) * (x - k) ** n;
    return s / factorial(n);
}

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(steps + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Irwin-Hall Distribution", () => {
    it("matches brute-force inclusion-exclusion density and CDF", () => {
        for (const n of [1, 2, 3, 4, 6]) {
            const steps = 24;
            const frames = [...mod.run({ n, steps })];
            checkFrames(frames, steps);
            const final = frames.at(-1)?.meta;
            const xs = final?.["xs"] as number[];
            const emittedPdf = final?.["pdf"] as number[];
            const emittedCdf = final?.["cdf"] as number[];
            xs.forEach((x, i) => {
                expect(emittedPdf[i]).toBeCloseTo(refPdf(x, n), 9);
                expect(emittedCdf[i]).toBeCloseTo(refCdf(x, n), 9);
            });
            expect(Number(final?.["mean"])).toBeCloseTo(n / 2, 9);
            expect(Number(final?.["variance"])).toBeCloseTo(n / 12, 9);
            expect(emittedCdf.at(-1)).toBeCloseTo(1, 9);
        }
    });

    it("has unit area and a symmetric density about n/2 on a fine grid", () => {
        const n = 4;
        const final = [...mod.run({ n, steps: 800 })].at(-1)?.meta;
        expect(Number(final?.["area"])).toBeCloseTo(1, 3);
        const pdf = final?.["pdf"] as number[];
        const len = pdf.length;
        for (let i = 0; i < len; i += 1) expect(pdf[i]).toBeCloseTo(pdf[len - 1 - i] as number, 6);
        const cdf = final?.["cdf"] as number[];
        for (let i = 1; i < cdf.length; i += 1) expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
    });

    it("reproduces the triangular case for n = 2", () => {
        const final = [...mod.run({ n: 2, steps: 8 })].at(-1)?.meta;
        const xs = final?.["xs"] as number[];
        const pdf = final?.["pdf"] as number[];
        xs.forEach((x, i) => {
            const expected = x <= 1 ? x : 2 - x;
            expect(pdf[i]).toBeCloseTo(expected, 9);
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
