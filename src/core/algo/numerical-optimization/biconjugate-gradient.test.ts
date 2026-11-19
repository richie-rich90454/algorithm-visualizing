/**
 * biconjugate-gradient.test.ts - Direct-solve cross-check, residual behavior, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./biconjugate-gradient";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function gaussianSolve(a: number[][], b: number[]): number[] {
    const n = b.length;
    const m = a.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let p = col;
        for (let r = col + 1; r < n; r += 1) if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[p]?.[col] ?? 0)) p = r;
        const t = m[col] as number[];
        m[col] = m[p] as number[];
        m[p] = t;
        const d = m[col]?.[col] ?? 0;
        for (let r = col + 1; r < n; r += 1) {
            const f = (m[r]?.[col] ?? 0) / d;
            for (let c = col; c <= n; c += 1) m[r]![c] = (m[r]?.[c] ?? 0) - f * (m[col]?.[c] ?? 0);
        }
    }
    const x = Array.from({ length: n }, () => 0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let s = m[i]?.[n] ?? 0;
        for (let j = i + 1; j < n; j += 1) s -= (m[i]?.[j] ?? 0) * (x[j] ?? 0);
        x[i] = s / (m[i]?.[i] ?? 1);
    }
    return x;
}

function residual(a: number[][], b: number[], x: number[]): number {
    return Math.sqrt(
        b.reduce((sum, bi, i) => {
            let ax = 0;
            for (let j = 0; j < a.length; j += 1) ax += (a[i]?.[j] ?? 0) * (x[j] ?? 0);
            return sum + (bi - ax) ** 2;
        }, 0),
    );
}

describe("Biconjugate gradient", () => {
    it("matches a direct solve on the default system", () => {
        const input = mod.defaultInput as { matrix: number[][]; b: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.b.length);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["converged"]).toBe(true);
        const x = last?.["solution"] as number[];
        const expected = gaussianSolve(input.matrix, input.b);
        x.forEach((value, i) => expect(value).toBeCloseTo(expected[i] ?? 0, 5));
    });

    it("converges on several diagonally dominant nonsymmetric systems", () => {
        const systems: Array<{ matrix: number[][]; b: number[] }> = [
            { matrix: [[6, 1, 2], [1, 7, 1], [2, 1, 8]], b: [3, 4, 5] },
            { matrix: [[5, 2, 0, 1], [1, 6, 2, 0], [0, 1, 7, 2], [1, 0, 1, 8]], b: [1, 2, 3, 4] },
        ];
        for (const input of systems) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.b.length);
            const last = frames[frames.length - 1]?.meta;
            const x = last?.["solution"] as number[];
            expect(residual(input.matrix, input.b, x)).toBeLessThan(1e-7);
        }
    });

    it("records a residual history that starts at the initial residual", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const hist = frames[frames.length - 1]?.meta["residualHistory"] as number[];
        expect(hist.length).toBeGreaterThan(1);
        expect(hist[0] as number).toBeGreaterThan(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
