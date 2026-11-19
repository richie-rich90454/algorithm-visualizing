import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./lemke-howson-nash";

type Matrix = number[][];

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
        expect(f.layout).toBe("graph");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => {
            expect(Number.isFinite(e.x)).toBe(true);
            expect(Number.isFinite(e.y)).toBe(true);
        });
        const ids = new Set(f.entities.map((n) => n.id));
        f.edges.forEach((e) => {
            expect(ids.has(e.sourceId)).toBe(true);
            expect(ids.has(e.targetId)).toBe(true);
        });
    });
}

/** Expected payoff of the row player for strategy x against y. */
function rowPayoff(M: Matrix, x: number[], y: number[]): number {
    let total = 0;
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) total += (x[i] ?? 0) * (M[i]?.[j] ?? 0) * (y[j] ?? 0);
    }
    return total;
}

/** Expected payoff of the column player for strategy y against x. */
function colPayoff(M: Matrix, x: number[], y: number[]): number {
    let total = 0;
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) total += (x[i] ?? 0) * (M[i]?.[j] ?? 0) * (y[j] ?? 0);
    }
    return total;
}

/** Check the Nash condition by testing every unilateral pure deviation. */
function isEquilibrium(A: Matrix, B: Matrix, x: number[], y: number[]): boolean {
    const u = rowPayoff(A, x, y);
    const v = colPayoff(B, x, y);
    for (let i = 0; i < 2; i += 1) {
        const dev = rowPayoff(A, [i === 0 ? 1 : 0, i === 1 ? 1 : 0], y);
        if (dev > u + 1e-6) return false;
    }
    for (let j = 0; j < 2; j += 1) {
        const dev = colPayoff(B, x, [j === 0 ? 1 : 0, j === 1 ? 1 : 0]);
        if (dev > v + 1e-6) return false;
    }
    return true;
}

/** Enumerate all 2x2 equilibria by support and return their payoff pairs. */
function bruteForcePayoffs(A: Matrix, B: Matrix): Array<[number, number]> {
    const results: Array<[number, number]> = [];
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
            const x = [i === 0 ? 1 : 0, i === 1 ? 1 : 0];
            const y = [j === 0 ? 1 : 0, j === 1 ? 1 : 0];
            if (isEquilibrium(A, B, x, y)) {
                results.push([rowPayoff(A, x, y), colPayoff(B, x, y)]);
            }
        }
    }
    // Fully mixed: solve the indifference equations exactly when possible.
    const denomY = (A[0]?.[0] ?? 0) - (A[0]?.[1] ?? 0) - (A[1]?.[0] ?? 0) + (A[1]?.[1] ?? 0);
    const denomX = (B[0]?.[0] ?? 0) - (B[1]?.[0] ?? 0) - (B[0]?.[1] ?? 0) + (B[1]?.[1] ?? 0);
    if (Math.abs(denomY) > 1e-9 && Math.abs(denomX) > 1e-9) {
        const q = ((A[1]?.[1] ?? 0) - (A[0]?.[1] ?? 0)) / denomY;
        const p = ((B[1]?.[1] ?? 0) - (B[1]?.[0] ?? 0)) / denomX;
        if (p >= -1e-9 && p <= 1 + 1e-9 && q >= -1e-9 && q <= 1 + 1e-9) {
            const x = [p, 1 - p];
            const y = [q, 1 - q];
            if (isEquilibrium(A, B, x, y)) {
                results.push([rowPayoff(A, x, y), colPayoff(B, x, y)]);
            }
        }
    }
    return results;
}

function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

describe("LemkeHowsonNash", () => {
    it("finds the mixed equilibrium of matching pennies", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(Boolean(last?.meta.equilibrium)).toBe(true);
        const x = last?.meta.rowStrategy as number[];
        const y = last?.meta.columnStrategy as number[];
        expect(x[0]).toBeCloseTo(0.5, 5);
        expect(y[0]).toBeCloseTo(0.5, 5);
        const input = mod.defaultInput as { A: Matrix; B: Matrix };
        const A = input.A;
        const B = input.B;
        expect(isEquilibrium(A, B, x, y)).toBe(true);
        expect(fs.length).toBeLessThan(12);
    });

    it("finds a true equilibrium on random bimatrix games", () => {
        const rng = makeRandom(77123);
        for (let t = 0; t < 120; t += 1) {
            const A: Matrix = [
                [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)],
                [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)],
            ];
            const B: Matrix = [
                [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)],
                [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)],
            ];
            const brute = bruteForcePayoffs(A, B);
            expect(brute.length).toBeGreaterThan(0);
            const fs = frames({ A, B });
            shapes(fs);
            const last = fs[fs.length - 1];
            expect(Boolean(last?.meta.equilibrium)).toBe(true);
            const x = last?.meta.rowStrategy as number[];
            const y = last?.meta.columnStrategy as number[];
            expect(x[0]).toBeGreaterThanOrEqual(-1e-9);
            expect(x[0]).toBeLessThanOrEqual(1 + 1e-9);
            expect(y[0]).toBeGreaterThanOrEqual(-1e-9);
            expect(y[0]).toBeLessThanOrEqual(1 + 1e-9);
            expect(isEquilibrium(A, B, x, y)).toBe(true);
            const got: [number, number] = [Number(last?.meta.rowPayoff), Number(last?.meta.colPayoff)];
            expect(brute.some(([u, v]) => Math.abs(u - got[0]) < 1e-5 && Math.abs(v - got[1]) < 1e-5)).toBe(true);
        }
    });
});
