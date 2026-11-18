/**
 * orthogonal-matching-pursuit.test.ts - Independent OMP reference, argmax selection, sparse recovery, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./orthogonal-matching-pursuit";
import type { VisualFrame } from "@/types";

interface Input {
    A: number[][];
    y: number[];
    K: number;
    tol: number;
}

const dot = (a: number[], x: number[]) => a.reduce((s, v, j) => s + v * (x[j] ?? 0), 0);

/** Independent least-squares solve via normal equations and elimination. */
function solve(M: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const aug = M.map((row, i) => [...row, rhs[i] ?? 0]);
    for (let c = 0; c < n; c += 1) {
        let p = c;
        for (let r = c + 1; r < n; r += 1) if (Math.abs(aug[r]![c]!) > Math.abs(aug[p]![c]!)) p = r;
        [aug[c], aug[p]] = [aug[p]!, aug[c]!];
        if (Math.abs(aug[c]![c]!) < 1e-12) return Array(n).fill(0);
        for (let r = c + 1; r < n; r += 1) {
            const f = aug[r]![c]! / aug[c]![c]!;
            for (let q = c; q <= n; q += 1) aug[r]![q] = aug[r]![q]! - f * aug[c]![q]!;
        }
    }
    const out = Array(n).fill(0) as number[];
    for (let i = n - 1; i >= 0; i -= 1) {
        let s = aug[i]![n]!;
        for (let j = i + 1; j < n; j += 1) s -= aug[i]![j]! * out[j]!;
        out[i] = s / aug[i]![i]!;
    }
    return out;
}

/** Independent OMP reference. */
function reference(input: Input) {
    const m = input.A.length;
    const n = input.A[0]!.length;
    const cols = Array.from({ length: n }, (_, j) => input.A.map((row) => row[j]!));
    const norms = cols.map((c) => Math.sqrt(dot(c, c)));
    const support: number[] = [];
    let coeffs = Array(n).fill(0) as number[];
    let residual = [...input.y];
    for (let k = 0; k < input.K; k += 1) {
        const corr = cols.map((c, j) => (norms[j]! > 1e-15 ? Math.abs(dot(c, residual)) / norms[j]! : 0));
        let best = -1;
        for (let j = 0; j < n; j += 1) {
            if (support.includes(j)) continue;
            if (best === -1 || corr[j]! > corr[best]!) best = j;
        }
        if (best === -1) break;
        support.push(best);
        const gram = support.map((i) => support.map((j) => dot(cols[i]!, cols[j]!)));
        const rhs = support.map((i) => dot(cols[i]!, input.y));
        const solved = solve(gram, rhs);
        coeffs = Array(n).fill(0) as number[];
        support.forEach((atom, s) => { coeffs[atom] = solved[s]!; });
        residual = input.y.map((yi, i) => yi - support.reduce((sum, atom, s) => sum + solved[s]! * cols[atom]![i]!, 0));
        if (Math.sqrt(residual.reduce((s, v) => s + v * v, 0)) <= input.tol) break;
    }
    return { support, coeffs, residual: Math.sqrt(residual.reduce((s, v) => s + v * v, 0)) };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("OrthogonalMatchingPursuit", () => {
    it("matches an independent OMP reference across dictionaries", () => {
        const cases: Input[] = [
            { A: [[1, 0, 0, 0, 0.5, 0.5], [0, 1, 0, 0, 0.5, -0.5], [0, 0, 1, 0, 0.5, 0.5], [0, 0, 0, 1, 0.5, -0.5]], y: [1.5, 0.5, 1.5, 0.5], K: 2, tol: 1e-8 },
            { A: [[1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 1]], y: [2, 3, 2], K: 2, tol: 1e-10 },
            { A: [[2, 0, 1], [0, 3, 1], [1, 1, 4]], y: [2, 6, 5], K: 1, tol: 1e-10 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.A[0]!.length);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(input);
            expect(final?.["support"]).toEqual(expected.support);
            const coeffs = final?.["coefficients"] as number[];
            for (let j = 0; j < input.A[0]!.length; j += 1) {
                expect(coeffs[j]).toBeCloseTo(expected.coeffs[j]!, 10);
            }
            expect(final?.["residual"] as number).toBeCloseTo(expected.residual, 10);
        }
    });

    it("recovers a two-sparse signal exactly", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        const coeffs = final?.["coefficients"] as number[];
        expect(final?.["support"]).toEqual([4, 5]);
        expect(coeffs[4]).toBeCloseTo(2, 10);
        expect(coeffs[5]).toBeCloseTo(1, 10);
        expect(final?.["residual"] as number).toBeLessThan(1e-10);
    });

    it("always selects the atom with the largest normalized correlation", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        for (let i = 1; i < frames.length - 1; i += 1) {
            const frame = frames[i]!;
            const chosen = frame.meta["chosenAtom"] as number;
            const corr = frame.meta["correlations"] as number[];
            const support = frame.meta["support"] as number[];
            const prevSupport = support.filter((j) => j !== chosen);
            const maxOther = Math.max(...corr.map((c, j) => (prevSupport.includes(j) ? -Infinity : c)));
            expect(corr[chosen]).toBeCloseTo(maxOther, 6);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
