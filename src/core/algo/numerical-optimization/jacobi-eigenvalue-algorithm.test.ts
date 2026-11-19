/**
 * jacobi-eigenvalue-algorithm.test.ts - Spectral reconstruction, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./jacobi-eigenvalue-algorithm";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Array.isArray(frame.meta["eigenvalues"])).toBe(true);
    });
}

function toMatrix(flat: number[], n: number): number[][] {
    return Array.from({ length: n }, (_, i) => flat.slice(i * n, (i + 1) * n));
}

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function symmetric(n: number, seed: number): number[][] {
    const random = rng(seed);
    const m = Array.from({ length: n }, () => Array.from({ length: n }, () => random() * 2 - 1));
    return m.map((row, i) => row.map((value, j) => (value + (m[j]?.[i] ?? 0)) / 2 + (i === j ? n : 0)));
}

describe("Jacobi eigenvalue algorithm", () => {
    it("converges on the default symmetric matrix", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const n = 3;
        checkFrames(frames, n);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["converged"]).toBe(true);
        expect(last?.["offNorm"] as number).toBeLessThan(1e-10);
    });

    it("satisfies A V = V diag(eigenvalues) and V orthogonal on random inputs", () => {
        for (const n of [2, 3, 4]) {
            for (const seed of [2, 7, 19]) {
                const matrix = symmetric(n, seed);
                const frames = [...mod.run({ matrix })];
                checkFrames(frames, n);
                const last = frames[frames.length - 1]?.meta;
                const eigenvalues = last?.["eigenvalues"] as number[];
                const v = toMatrix(last?.["vectors"] as number[], n);
                for (let row = 0; row < n; row += 1) {
                    for (let col = 0; col < n; col += 1) {
                        let av = 0;
                        let ve = 0;
                        let vtv = 0;
                        for (let k = 0; k < n; k += 1) {
                            av += (matrix[row]?.[k] ?? 0) * (v[k]?.[col] ?? 0);
                            ve += (v[row]?.[k] ?? 0) * (k === col ? eigenvalues[k] ?? 0 : 0);
                            vtv += (v[k]?.[row] ?? 0) * (v[k]?.[col] ?? 0);
                        }
                        expect(av).toBeCloseTo(ve, 6);
                        expect(vtv).toBeCloseTo(row === col ? 1 : 0, 6);
                    }
                }
                const trace = matrix.reduce((s, row, i) => s + (row[i] ?? 0), 0);
                expect(eigenvalues.reduce((s, x) => s + x, 0)).toBeCloseTo(trace, 6);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
