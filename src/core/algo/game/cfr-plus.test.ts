import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./cfr-plus";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapeCheck(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("grid");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
        expect(f.meta.rows).toBeDefined();
        expect(f.meta.cols).toBeDefined();
    });
}

describe("CfrPlus", () => {
    it("converges to the uniform equilibrium of rock-paper-scissors", () => {
        const payoff = [
            [0, -1, 1],
            [1, 0, -1],
            [-1, 1, 0],
        ];
        const fs = frames({ payoff, iterations: 4000 });
        shapeCheck(fs);
        const last = fs[fs.length - 1];
        expect(last?.meta.converged).toBe(true);
        const avg1 = last?.meta.avg1 as number[];
        const avg2 = last?.meta.avg2 as number[];
        for (const p of avg1) expect(p).toBeCloseTo(1 / 3, 1);
        for (const p of avg2) expect(p).toBeCloseTo(1 / 3, 1);
        expect(Number(last?.meta.exploitability)).toBeLessThan(0.1);
    });

    it("learns the dominant-action equilibrium of a matrix game", () => {
        const payoff = [
            [3, 1],
            [2, 0],
        ];
        const fs = frames({ payoff, iterations: 2000 });
        shapeCheck(fs);
        const last = fs[fs.length - 1];
        const avg1 = last?.meta.avg1 as number[];
        const avg2 = last?.meta.avg2 as number[];
        // Row 0 strictly dominates row 1; column 1 strictly dominates column 0.
        expect(avg1[0]).toBeGreaterThan(0.9);
        expect(avg2[1]).toBeGreaterThan(0.9);
    });

    it("keeps clipped nonnegative regrets and normalized strategies at every frame", () => {
        const fs = frames(mod.defaultInput);
        shapeCheck(fs);
        for (const f of fs) {
            for (const key of ["regret1", "regret2"]) {
                const r = f.meta[key] as number[];
                expect(r.every((x) => x >= 0)).toBe(true);
            }
            for (const key of ["p1", "p2", "avg1", "avg2"]) {
                const s = f.meta[key] as number[];
                expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
            }
        }
    });
});
