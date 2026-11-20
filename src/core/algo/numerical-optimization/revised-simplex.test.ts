/**
 * revised-simplex.test.ts - Brute-force basis enumeration check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./revised-simplex";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], vars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(vars);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function inverse(M: number[][]): number[][] | null {
    const n = M.length;
    const aug = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r]![col]!) > Math.abs(aug[pivot]![col]!)) pivot = r;
        }
        if (Math.abs(aug[pivot]![col]!) < 1e-12) return null;
        [aug[col], aug[pivot]] = [aug[pivot]!, aug[col]!];
        const div = aug[col]![col]!;
        for (let c = 0; c < 2 * n; c += 1) aug[col]![c] = aug[col]![c]! / div;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = aug[r]![col]!;
            for (let c = 0; c < 2 * n; c += 1) aug[r]![c] = aug[r]![c]! - factor * aug[col]![c]!;
        }
    }
    return aug.map((row) => row.slice(n));
}

/** Brute force: evaluate every basic feasible solution and take the best. */
function bruteForceOptimum(A: number[][], b: number[], c: number[]): number {
    const m = A.length;
    const n = A[0]!.length;
    const total = n + m;
    const cbar = [...c, ...Array.from({ length: m }, () => 0)];
    const Abar = A.map((row, i) => [...row, ...Array.from({ length: m }, (_, k) => (k === i ? 1 : 0))]);
    let best = Number.NEGATIVE_INFINITY;
    const choose = (start: number, picked: number[]) => {
        if (picked.length === m) {
            const cols = picked.map((j) => Abar.map((row) => row[j]!));
            const B = Array.from({ length: m }, (_, r) => Array.from({ length: m }, (_, c) => cols[c]![r]!));
            const Binv = inverse(B);
            if (!Binv) return;
            const xB = Binv.map((row) => row.reduce((sum, v, i) => sum + v * b[i]!, 0));
            if (xB.some((v) => v < -1e-9)) return;
            const obj = picked.reduce((sum, j, i) => sum + cbar[j]! * xB[i]!, 0);
            if (obj > best) best = obj;
            return;
        }
        for (let j = start; j < total; j += 1) choose(j + 1, [...picked, j]);
    };
    choose(0, []);
    return best;
}

describe("Revised Simplex", () => {
    it("matches brute-force enumeration on the default problem", () => {
        const input = mod.defaultInput as { A: number[][]; b: number[]; c: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.A[0]!.length + input.A.length);
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["optimal"]).toBe(true);
        expect(Number(meta["objective"])).toBeCloseTo(bruteForceOptimum(input.A, input.b, input.c), 8);
    });

    it("matches brute force on several small bounded LPs", () => {
        const cases: Array<{ A: number[][]; b: number[]; c: number[] }> = [
            { A: [[1, 1], [2, 1]], b: [6, 8], c: [3, 2] },
            { A: [[1, 0], [0, 1], [1, 1]], b: [4, 3, 5], c: [2, 3] },
            { A: [[1, 2], [3, 1], [1, 1]], b: [10, 12, 6], c: [4, 5] },
            { A: [[2, 1], [1, 2], [1, 1]], b: [8, 8, 5], c: [5, 4] },
        ];
        for (const lp of cases) {
            const frames = [...mod.run(lp)];
            const meta = frames[frames.length - 1]!.meta;
            expect(meta["optimal"]).toBe(true);
            expect(Number(meta["objective"])).toBeCloseTo(bruteForceOptimum(lp.A, lp.b, lp.c), 8);
            const solution = meta["solution"] as number[];
            let feasible = true;
            for (let i = 0; i < lp.A.length; i += 1) {
                const lhs = lp.A[i]!.reduce((sum, a, j) => sum + a * solution[j]!, 0);
                if (lhs > lp.b[i]! + 1e-8) feasible = false;
            }
            expect(feasible).toBe(true);
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
