import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./shapley-value";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("array");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

// Independent subset formula for the Shapley value.
function subsetShapley(weights: number[], quota: number): number[] {
    const n = weights.length;
    const v = (s: number[]): number => (s.reduce((a, i) => a + (weights[i] ?? 0), 0) >= quota ? 1 : 0);
    const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));
    const result = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        const others = weights.map((_, k) => k).filter((k) => k !== i);
        for (let mask = 0; mask < 2 ** (n - 1); mask += 1) {
            const s = others.filter((_, bit) => (mask & (1 << bit)) !== 0);
            const term = (factorial(s.length) * factorial(n - s.length - 1)) / factorial(n);
            result[i] = (result[i] ?? 0) + term * (v([...s, i]) - v(s));
        }
    }
    return result;
}

describe("ShapleyValue", () => {
    const cases = [
        { weights: [4, 3, 2], quota: 5 },
        { weights: [3, 3, 1], quota: 4 },
        { weights: [5, 2, 1], quota: 4 },
    ];
    it("matches the independent subset-formula computation", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const expected = subsetShapley(input.weights, input.quota);
            const got = fs[fs.length - 1]?.meta.shapley as number[];
            for (let i = 0; i < input.weights.length; i += 1) {
                expect(got[i]).toBeCloseTo(expected[i] ?? 0, 9);
            }
        }
    });
    it("satisfies efficiency and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        const sh = last?.meta.shapley as number[];
        expect(sh.reduce((a, b) => a + b, 0)).toBeCloseTo(Number(last?.meta.totalValue), 9);
        expect(Number(last?.meta.sum)).toBeCloseTo(1, 9);
    });
});
