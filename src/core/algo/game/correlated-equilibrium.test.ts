import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./correlated-equilibrium";

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
        expect(f.meta.distribution).toBeDefined();
    });
}

/** Check every no-deviation inequality of a correlated equilibrium. */
function isCorrelatedEquilibrium(p: number[], a: number[][], b: number[][]): boolean {
    const n = a.length;
    const m = a[0]?.length ?? 0;
    const at = (i: number, j: number): number => p[i * m + j] ?? 0;
    for (let i = 0; i < n; i += 1) {
        for (let from = 0; from < n; from += 1) {
            let gain = 0;
            for (let j = 0; j < m; j += 1) {
                gain += at(i, j) * ((a[from]?.[j] ?? 0) - (a[i]?.[j] ?? 0));
            }
            if (gain > 1e-8) return false;
        }
    }
    for (let j = 0; j < m; j += 1) {
        for (let from = 0; from < m; from += 1) {
            let gain = 0;
            for (let i = 0; i < n; i += 1) {
                gain += at(i, j) * ((b[i]?.[from] ?? 0) - (b[i]?.[j] ?? 0));
            }
            if (gain > 1e-8) return false;
        }
    }
    return true;
}

function welfare(p: number[], a: number[][], b: number[][]): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < (a[0]?.length ?? 0); j += 1) {
            total += (p[i * (a[0]?.length ?? 0) + j] ?? 0) * ((a[i]?.[j] ?? 0) + (b[i]?.[j] ?? 0));
        }
    }
    return total;
}

/** Brute-force lower bound on optimal welfare by scanning a fine simplex grid. */
function gridBestWelfare(a: number[][], b: number[][]): number {
    const steps = 20;
    let best = -Infinity;
    for (let x = 0; x <= steps; x += 1) {
        for (let y = 0; x + y <= steps; y += 1) {
            for (let z = 0; x + y + z <= steps; z += 1) {
                const p = [x / steps, y / steps, z / steps, 1 - (x + y + z) / steps];
                if (isCorrelatedEquilibrium(p, a, b)) best = Math.max(best, welfare(p, a, b));
            }
        }
    }
    return best;
}

describe("CorrelatedEquilibrium", () => {
    it("finds a welfare-maximizing equilibrium of Battle of the Sexes", () => {
        const a = [[2, 0], [0, 1]];
        const b = [[1, 0], [0, 2]];
        const fs = frames({ payoffA: a, payoffB: b });
        shapeCheck(fs);
        const last = fs[fs.length - 1];
        const p = last?.meta.distribution as number[];
        expect(p.reduce((acc, x) => acc + x, 0)).toBeCloseTo(1, 6);
        expect(p.every((x) => x >= -1e-9)).toBe(true);
        expect(isCorrelatedEquilibrium(p, a, b)).toBe(true);
        expect(Number(last?.meta.bestWelfare)).toBeCloseTo(3, 6);
        expect(welfare(p, a, b)).toBeCloseTo(3, 6);
        expect(last?.meta.converged).toBe(true);
    });

    it("returns the unique equilibrium of the prisoner's dilemma", () => {
        const a = [[-1, -3], [0, -2]];
        const b = [[-1, 0], [-3, -2]];
        const fs = frames({ payoffA: a, payoffB: b });
        shapeCheck(fs);
        const p = fs[fs.length - 1]?.meta.distribution as number[];
        expect(isCorrelatedEquilibrium(p, a, b)).toBe(true);
        expect(p[3]).toBeCloseTo(1, 6);
        expect(welfare(p, a, b)).toBeCloseTo(-4, 6);
    });

    it("matches a brute-force welfare lower bound on random games", () => {
        for (let seed = 1; seed <= 8; seed += 1) {
            let state = seed * 2654435761 >>> 0;
            const next = (): number => {
                state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
                return (state % 9) - 4;
            };
            const a = [[next(), next()], [next(), next()]];
            const b = [[next(), next()], [next(), next()]];
            const fs = frames({ payoffA: a, payoffB: b });
            shapeCheck(fs);
            const p = fs[fs.length - 1]?.meta.distribution as number[];
            expect(isCorrelatedEquilibrium(p, a, b)).toBe(true);
            expect(welfare(p, a, b)).toBeGreaterThanOrEqual(gridBestWelfare(a, b) - 1e-9);
        }
    });
});
