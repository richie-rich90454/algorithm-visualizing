/** inverse-gaussian-distribution.test.ts - closed-form pdf/cdf, moments, unit area, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./inverse-gaussian-distribution";
import type { VisualFrame } from "@/types";

function normalCdf(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    const upper = (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
    return z >= 0 ? 1 - upper : upper;
}
function pdf(x: number, mu: number, lambda: number): number {
    if (x <= 0) return 0;
    return Math.sqrt(lambda / (2 * Math.PI * x ** 3)) * Math.exp((-lambda * (x - mu) ** 2) / (2 * mu * mu * x));
}
function cdf(x: number, mu: number, lambda: number): number {
    if (x <= 0) return 0;
    const root = Math.sqrt(lambda / x);
    return normalCdf(root * (x / mu - 1)) + Math.exp((2 * lambda) / mu) * normalCdf(-root * (x / mu + 1));
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

describe("Inverse Gaussian Distribution", () => {
    it("matches the closed-form density and cumulative curve", () => {
        for (const p of [{ mu: 2, lambda: 4 }, { mu: 1, lambda: 2 }, { mu: 3, lambda: 10 }]) {
            const frames = [...mod.run({ ...p, steps: 20, maxX: 4 * p.mu })];
            checkFrames(frames, 20);
            const meta = frames.at(-1)?.meta;
            const xs = meta?.["xs"] as number[];
            const emittedPdf = meta?.["pdf"] as number[];
            const emittedCdf = meta?.["cdf"] as number[];
            xs.forEach((x, i) => {
                expect(emittedPdf[i]).toBeCloseTo(pdf(x, p.mu, p.lambda), 9);
                expect(emittedCdf[i]).toBeCloseTo(cdf(x, p.mu, p.lambda), 9);
            });
            expect(Number(meta?.["mean"])).toBeCloseTo(p.mu, 9);
            expect(Number(meta?.["variance"])).toBeCloseTo(p.mu ** 3 / p.lambda, 9);
        }
    });

    it("has a monotone cumulative curve that approaches one and a near-unit area", () => {
        const meta = [...mod.run({ mu: 2, lambda: 4, steps: 500, maxX: 40 })].at(-1)?.meta;
        expect(Number(meta?.["area"])).toBeCloseTo(1, 3);
        const c = meta?.["cdf"] as number[];
        for (let i = 1; i < c.length; i += 1) expect(c[i] as number).toBeGreaterThanOrEqual(c[i - 1] as number);
        expect(c.at(-1)).toBeCloseTo(1, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
