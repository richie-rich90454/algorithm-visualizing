/**
 * dual-simplex.test.ts - Brute-force vertex enumeration cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dual-simplex";
import type { VisualFrame } from "@/types";

interface Lp {
    c: number[];
    A: number[][];
    b: number[];
}

/** Solve a small square linear system by Gaussian elimination; null on singularity. */
function solveSquare(M: number[][], rhs: number[]): number[] | null {
    const n = M.length;
    const a = M.map((row, i) => [...row, rhs[i]!]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
        }
        if (Math.abs(a[pivot]![col]!) < 1e-10) return null;
        const tmp = a[col]!;
        a[col] = a[pivot]!;
        a[pivot] = tmp;
        for (let row = col + 1; row < n; row += 1) {
            const factor = a[row]![col]! / a[col]![col]!;
            for (let j = col; j <= n; j += 1) a[row]![j] = a[row]![j]! - factor * a[col]![j]!;
        }
    }
    const x = Array.from({ length: n }, () => 0);
    for (let row = n - 1; row >= 0; row -= 1) {
        let sum = a[row]![n]!;
        for (let j = row + 1; j < n; j += 1) sum -= a[row]![j]! * x[j]!;
        x[row] = sum / a[row]![row]!;
    }
    return x;
}

/** Brute-force optimum by enumerating all bases and testing feasibility. */
function bruteForceOptimum(lp: Lp): number {
    const n = lp.c.length;
    const m = lp.b.length;
    const total = n + m;
    let best = Number.POSITIVE_INFINITY;
    const choose = (start: number, picked: number[], basis: number[]): void => {
        if (picked.length === m) {
            const M = Array.from({ length: m }, (_, row) =>
                basis.map((col) => (col < n ? lp.A[row]![col]! : col - n === row ? -1 : 0)),
            );
            const values = solveSquare(M, lp.b);
            if (!values) return;
            const x = Array.from({ length: n }, () => 0);
            for (let i = 0; i < m; i += 1) {
                if (basis[i]! < n) x[basis[i]!] = values[i]!;
            }
            if (x.some((value) => value < -1e-7)) return;
            for (let row = 0; row < m; row += 1) {
                let lhs = 0;
                for (let col = 0; col < n; col += 1) lhs += lp.A[row]![col]! * x[col]!;
                if (lhs < lp.b[row]! - 1e-7) return;
            }
            const objective = x.reduce((sum, value, index) => sum + value * lp.c[index]!, 0);
            if (objective < best) best = objective;
            return;
        }
        for (let col = start; col < total; col += 1) {
            picked.push(col);
            basis.push(col);
            choose(col + 1, picked, basis);
            basis.pop();
            picked.pop();
        }
    };
    choose(0, [], []);
    return best;
}

function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 16807) + 7) >>> 0;
        return state / 0x100000000;
    };
}

function checkFrames(frames: VisualFrame[], size: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(size);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Dual Simplex", () => {
    it("matches brute-force vertex enumeration on random feasible programs", () => {
        const random = makeRandom(53);
        for (let trial = 0; trial < 120; trial += 1) {
            const n = 2;
            const m = 2 + Math.floor(random() * 2);
            const lp: Lp = {
                c: Array.from({ length: n }, () => 1 + Math.floor(random() * 4)),
                A: Array.from({ length: m }, () =>
                    Array.from({ length: n }, () => 1 + Math.floor(random() * 3)),
                ),
                b: Array.from({ length: m }, () => 1 + Math.floor(random() * 5)),
            };
            const frames = [...mod.run(lp)];
            checkFrames(frames, n + m);
            const finalMeta = frames[frames.length - 1]!.meta;
            const expected = bruteForceOptimum(lp);
            expect(finalMeta["infeasible"]).toBe(false);
            expect(finalMeta["optimal"]).toBe(true);
            expect(Number(finalMeta["objective"])).toBeCloseTo(expected, 6);

            const solution = finalMeta["solution"] as number[];
            for (let row = 0; row < m; row += 1) {
                let lhs = 0;
                for (let col = 0; col < n; col += 1) lhs += lp.A[row]![col]! * solution[col]!;
                expect(lhs).toBeGreaterThanOrEqual(lp.b[row]! - 1e-6);
            }
            for (let col = 0; col < n; col += 1) {
                expect(solution[col]!).toBeGreaterThanOrEqual(-1e-6);
            }
        }
    });

    it("solves the textbook example", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const finalMeta = frames[frames.length - 1]!.meta;
        expect(Number(finalMeta["objective"])).toBeCloseTo(10, 6);
        const solution = finalMeta["solution"] as number[];
        expect(solution[0]!).toBeCloseTo(2, 6);
        expect(solution[1]!).toBeCloseTo(2, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
