import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./regret-matching";

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
        expect(f.layout).toBe("grid");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

function recomputeRegrets(histA: number[], histB: number[], A: number[], B: number[]): { a: [number, number]; b: [number, number] } {
    const out = { a: [0, 0] as [number, number], b: [0, 0] as [number, number] };
    for (let t = 0; t < histA.length; t += 1) {
        const a = histA[t] ?? 0;
        const b = histB[t] ?? 0;
        for (let k = 0; k < 2; k += 1) {
            out.a[k] = (out.a[k] ?? 0) + ((A[k * 2 + b] ?? 0) - (A[a * 2 + b] ?? 0));
            out.b[k] = (out.b[k] ?? 0) + ((B[a * 2 + k] ?? 0) - (B[a * 2 + b] ?? 0));
        }
    }
    return out;
}

describe("RegretMatching", () => {
    const A = [4, 1, 3, 0];
    const B = [3, 1, 2, 0];
    it("recomputes regrets and strategy probabilities from the recorded action history", () => {
        const fs = frames({ payoffsA: [[4, 1], [3, 0]], payoffsB: [[3, 1], [2, 0]], rounds: 30, seed: 12345 });
        shapes(fs);
        for (const f of fs) {
            if (!Array.isArray(f.meta.historyA)) continue;
            const expected = recomputeRegrets(f.meta.historyA as number[], f.meta.historyB as number[], A, B);
            const gotA = f.meta.regretA as number[];
            const gotB = f.meta.regretB as number[];
            for (let k = 0; k < 2; k += 1) {
                expect(gotA[k]).toBeCloseTo(expected.a[k] ?? 0, 9);
                expect(gotB[k]).toBeCloseTo(expected.b[k] ?? 0, 9);
            }
            const sA = f.meta.strategyA as number[];
            const sB = f.meta.strategyB as number[];
            expect(sA[0]! + sA[1]!).toBeCloseTo(1, 9);
            expect(sB[0]! + sB[1]!).toBeCloseTo(1, 9);
        }
    });
    it("concentrates average play on the dominant action and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        const avgA = last?.meta.avgA as number[];
        expect(avgA[0]).toBeGreaterThan(0.6);
        expect(avgA[0]! + avgA[1]!).toBeCloseTo(1, 9);
    });
});
