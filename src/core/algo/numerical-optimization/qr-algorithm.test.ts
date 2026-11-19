/**
 * qr-algorithm.test.ts - Trace/determinant and eigenpair cross-checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./qr-algorithm";
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
    });
}

function toMatrix(flat: number[], n: number): number[][] {
    return Array.from({ length: n }, (_, i) => flat.slice(i * n, (i + 1) * n));
}

function determinant(a: number[][]): number {
    const n = a.length;
    const m = a.map((row) => [...row]);
    let det = 1;
    for (let col = 0; col < n; col += 1) {
        let p = col;
        for (let r = col + 1; r < n; r += 1) if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[p]?.[col] ?? 0)) p = r;
        if (p !== col) {
            const t = m[col] as number[];
            m[col] = m[p] as number[];
            m[p] = t;
            det = -det;
        }
        const d = m[col]?.[col] ?? 0;
        det *= d;
        for (let r = col + 1; r < n; r += 1) {
            const f = (m[r]?.[col] ?? 0) / d;
            for (let c = col; c < n; c += 1) m[r]![c] = (m[r]![c] ?? 0) - f * (m[col]![c] ?? 0);
        }
    }
    return det;
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

describe("QR algorithm", () => {
    it("converges on the default symmetric matrix", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        expect(frames[frames.length - 1]?.meta["converged"]).toBe(true);
        expect(frames[frames.length - 1]?.meta["offNorm"] as number).toBeLessThan(1e-9);
    });

    it("preserves trace and determinant and yields correct eigenpairs on random inputs", () => {
        for (const n of [2, 3, 4]) {
            for (const seed of [3, 9, 21]) {
                const matrix = symmetric(n, seed);
                const frames = [...mod.run({ matrix, iterations: 1200 })];
                checkFrames(frames, n);
                const last = frames[frames.length - 1]?.meta;
                expect(last?.["converged"]).toBe(true);
                const eigenvalues = last?.["eigenvalues"] as number[];
                const v = toMatrix(last?.["vectors"] as number[], n);
                const trace = matrix.reduce((s, row, i) => s + (row[i] ?? 0), 0);
                expect(eigenvalues.reduce((s, x) => s + x, 0)).toBeCloseTo(trace, 5);
                expect(eigenvalues.reduce((p, x) => p * x, 1)).toBeCloseTo(determinant(matrix), 4);
                for (let row = 0; row < n; row += 1) {
                    for (let col = 0; col < n; col += 1) {
                        let av = 0;
                        let ve = 0;
                        for (let k = 0; k < n; k += 1) {
                            av += (matrix[row]?.[k] ?? 0) * (v[k]?.[col] ?? 0);
                            ve += (v[row]?.[k] ?? 0) * (k === col ? eigenvalues[k] ?? 0 : 0);
                        }
                        expect(av).toBeCloseTo(ve, 4);
                    }
                }
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
