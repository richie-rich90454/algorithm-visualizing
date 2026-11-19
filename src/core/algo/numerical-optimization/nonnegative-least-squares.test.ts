/**
 * nonnegative-least-squares.test.ts - Brute-force optimality and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./nonnegative-least-squares";
import type { VisualFrame } from "@/types";

/** Solve a small dense linear system with partial pivoting. */
function solve(system: number[][], right: number[]): number[] {
    const n = right.length;
    const a = system.map((row, i) => [...row, right[i]!]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
        }
        const tmp = a[col]!;
        a[col] = a[pivot]!;
        a[pivot] = tmp;
        for (let row = col + 1; row < n; row += 1) {
            const factor = a[row]![col]! / (a[col]![col]! || 1);
            for (let j = col; j <= n; j += 1) a[row]![j]! -= factor * a[col]![j]!;
        }
    }
    const out = Array.from({ length: n }, () => 0);
    for (let row = n - 1; row >= 0; row -= 1) {
        let sum = a[row]![n]!;
        for (let j = row + 1; j < n; j += 1) sum -= a[row]![j]! * out[j]!;
        out[row] = sum / (a[row]![row]! || 1);
    }
    return out;
}

/** Brute-force NNLS optimum by trying every subset of free variables. */
function bruteForce(a: number[][], b: number[], n: number) {
    let bestObjective = Infinity;
    let bestX = Array.from({ length: n }, () => 0);
    for (let mask = 0; mask < 1 << n; mask += 1) {
        const subset: number[] = [];
        for (let col = 0; col < n; col += 1) if (mask & (1 << col)) subset.push(col);
        const k = subset.length;
        const x = Array.from({ length: n }, () => 0);
        if (k === 0) {
            const obj = b.reduce((sum, value) => sum + value * value, 0);
            if (obj < bestObjective) {
                bestObjective = obj;
                bestX = x;
            }
            continue;
        }
        const gram = Array.from({ length: k }, () => Array.from({ length: k }, () => 0));
        const rhs = Array.from({ length: k }, () => 0);
        for (let i = 0; i < k; i += 1) {
            for (let j = 0; j < k; j += 1) {
                for (let row = 0; row < a.length; row += 1) {
                    gram[i]![j]! += a[row]![subset[i]!]! * a[row]![subset[j]!]!;
                }
            }
            for (let row = 0; row < a.length; row += 1) rhs[i]! += a[row]![subset[i]!]! * b[row]!;
            gram[i]![i]! += 1e-10;
        }
        const coeffs = solve(gram, rhs);
        if (!coeffs.every(Number.isFinite) || !coeffs.every((v) => v >= -1e-7)) continue;
        for (let i = 0; i < k; i += 1) x[subset[i]!] = Math.max(0, coeffs[i]!);
        let objective = 0;
        for (let row = 0; row < a.length; row += 1) {
            let residual = b[row]!;
            for (let col = 0; col < n; col += 1) residual -= a[row]![col]! * x[col]!;
            objective += residual * residual;
        }
        if (objective < bestObjective) {
            bestObjective = objective;
            bestX = x;
        }
    }
    return { objective: bestObjective, x: bestX };
}

function objectiveOf(a: number[][], b: number[], x: number[]): number {
    let total = 0;
    for (let row = 0; row < a.length; row += 1) {
        let residual = b[row]!;
        for (let col = 0; col < x.length; col += 1) residual -= a[row]![col]! * x[col]!;
        total += residual * residual;
    }
    return total;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Nonnegative least squares", () => {
    const cases: Array<{ a: number[][]; b: number[] }> = [
        { a: [[1, 1], [1, 2], [1, 3], [1, 4]], b: [1, 2, 2, 3] },
        { a: [[2, 0], [0, 3], [1, 1]], b: [2, 3, 2] },
        { a: [[1, 2, 0], [2, 1, 1], [0, 1, 2], [1, 0, 1]], b: [3, 4, 2, 2] },
    ];

    it("matches the brute-force optimum on small problems", () => {
        for (const { a, b } of cases) {
            const n = a[0]!.length;
            const frames = [...mod.run({ matrix: a, vector: b })];
            checkFrames(frames, n);
            const final = frames[frames.length - 1]!.meta;
            const x = (final["x"] as number[]).map(Number);
            expect(x.every((value) => value >= -1e-9)).toBe(true);
            const actual = objectiveOf(a, b, x);
            const expected = bruteForce(a, b, n);
            expect(actual).toBeCloseTo(expected.objective, 6);
            for (let col = 0; col < n; col += 1) {
                expect(x[col]).toBeCloseTo(expected.x[col]!, 5);
            }
        }
    });

    it("satisfies the KKT sign conditions", () => {
        for (const { a, b } of cases) {
            const frames = [...mod.run({ matrix: a, vector: b })];
            const x = (frames[frames.length - 1]!.meta["x"] as number[]).map(Number);
            for (let col = 0; col < x.length; col += 1) {
                let grad = 0;
                for (let row = 0; row < a.length; row += 1) {
                    let residual = b[row]!;
                    for (let j = 0; j < x.length; j += 1) residual -= a[row]![j]! * x[j]!;
                    grad += a[row]![col]! * residual;
                }
                if (x[col]! <= 1e-8) {
                    expect(grad).toBeLessThanOrEqual(1e-5);
                } else {
                    expect(Math.abs(grad)).toBeLessThanOrEqual(1e-5);
                }
            }
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
