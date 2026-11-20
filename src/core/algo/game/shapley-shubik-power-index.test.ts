import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./shapley-shubik-power-index";

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
        expect(f.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("array");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

// Independent subset formula for the Shapley value of a simple game.
function subsetPower(weights: number[], quota: number): number[] {
    const n = weights.length;
    const win = (s: number[]): number => (s.reduce((a, i) => a + (weights[i] ?? 0), 0) >= quota ? 1 : 0);
    const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
    const out = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        const others = weights.map((_, k) => k).filter((k) => k !== i);
        for (let mask = 0; mask < 2 ** (n - 1); mask += 1) {
            const s = others.filter((_, bit) => (mask & (1 << bit)) !== 0);
            out[i] = (out[i] ?? 0) + (fact(s.length) * fact(n - s.length - 1)) / fact(n) * (win([...s, i]) - win(s));
        }
    }
    return out;
}

describe("ShapleyShubikPowerIndex", () => {
    const cases = [
        { weights: [4, 3, 2, 1], quota: 6 },
        { weights: [4, 3, 2], quota: 5 },
        { weights: [3, 3, 1, 1], quota: 5 },
    ];

    it("matches the independent subset-formula computation", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const expected = subsetPower(input.weights, input.quota);
            const got = fs[fs.length - 1]?.meta.powers as number[];
            for (let i = 0; i < input.weights.length; i += 1) {
                expect(got[i]).toBeCloseTo(expected[i] ?? 0, 9);
            }
        }
    });

    it("sums to one and terminates", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const last = fs[fs.length - 1];
            const powers = last?.meta.powers as number[];
            expect(powers.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
            expect(Number(last?.meta.orderings)).toBe(fact(input.weights.length));
            expect(fs[fs.length - 1]?.stepNumber).toBe(fs.length - 1);
        }
    });
});

function fact(k: number): number {
    return k <= 1 ? 1 : k * fact(k - 1);
}
