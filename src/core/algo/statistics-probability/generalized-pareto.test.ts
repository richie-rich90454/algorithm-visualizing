/** generalized-pareto.test.ts - survival/density formulas, quantile median, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./generalized-pareto";
import type { VisualFrame } from "@/types";

function survival(x: number, xi: number, sigma: number, mu: number): number {
    if (x <= mu) return 1;
    const z = (x - mu) / sigma;
    if (xi < 0 && z >= -1 / xi) return 0;
    if (Math.abs(xi) < 1e-9) return Math.exp(-z);
    return Math.pow(Math.max(1 + xi * z, 0), -1 / xi);
}
function median(xi: number, sigma: number, mu: number): number {
    if (Math.abs(xi) < 1e-9) return mu - sigma * Math.log(0.5);
    return mu + (sigma * (Math.pow(0.5, -xi) - 1)) / xi;
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

describe("Generalized Pareto", () => {
    it("matches the survival-derived density and cumulative curve", () => {
        for (const p of [{ xi: 0.2, sigma: 1, mu: 0 }, { xi: 0, sigma: 2, mu: 1 }, { xi: -0.3, sigma: 1.5, mu: -1 }]) {
            const frames = [...mod.run({ ...p, steps: 20, maxX: p.mu + 6 * p.sigma })];
            checkFrames(frames, 20);
            const meta = frames.at(-1)?.meta;
            const xs = meta?.["xs"] as number[];
            const pdf = meta?.["pdf"] as number[];
            const cdf = meta?.["cdf"] as number[];
            xs.forEach((x, i) => {
                const s = survival(x, p.xi, p.sigma, p.mu);
                expect(cdf[i]).toBeCloseTo(1 - s, 9);
                const expected = Math.abs(p.xi) < 1e-9
                    ? Math.exp(-(x - p.mu) / p.sigma) / p.sigma
                    : s / (p.sigma * Math.max(1 + p.xi * (x - p.mu) / p.sigma, 1e-12));
                expect(pdf[i]).toBeCloseTo(expected, 9);
            });
        }
    });

    it("inverts the cumulative curve to the analytic median", () => {
        for (const p of [{ xi: 0.2, sigma: 1, mu: 0 }, { xi: 0, sigma: 2, mu: 1 }, { xi: 0.5, sigma: 1, mu: 0 }]) {
            const meta = [...mod.run({ ...p, steps: 8 })].at(-1)?.meta;
            expect(Number(meta?.["median"])).toBeCloseTo(median(p.xi, p.sigma, p.mu), 9);
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
