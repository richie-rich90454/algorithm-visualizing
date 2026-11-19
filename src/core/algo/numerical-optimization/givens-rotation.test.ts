/**
 * givens-rotation.test.ts - QR reconstruction, orthogonality, triangularity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./givens-rotation";
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

function verify(matrix: number[][]): void {
    const n = matrix.length;
    const frames = [...mod.run({ matrix })];
    checkFrames(frames, n);
    const last = frames[frames.length - 1]?.meta;
    const r = toMatrix(last?.["r"] as number[], n);
    const q = toMatrix(last?.["q"] as number[], n);
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            if (i > j) expect(r[i]?.[j] ?? 0).toBeCloseTo(0, 8);
            let qr = 0;
            let qtq = 0;
            for (let k = 0; k < n; k += 1) {
                qr += (q[i]?.[k] ?? 0) * (r[k]?.[j] ?? 0);
                qtq += (q[k]?.[i] ?? 0) * (q[k]?.[j] ?? 0);
            }
            expect(qr).toBeCloseTo(matrix[i]?.[j] ?? 0, 8);
            expect(qtq).toBeCloseTo(i === j ? 1 : 0, 8);
        }
    }
}

describe("Givens rotation", () => {
    it("factors the default matrix correctly", () => {
        verify((mod.defaultInput as { matrix: number[][] }).matrix);
    });

    it("factors random square matrices correctly", () => {
        for (const n of [2, 3, 4]) {
            for (const seed of [1, 6, 13]) {
                const random = rng(seed);
                verify(Array.from({ length: n }, () => Array.from({ length: n }, () => random() * 4 - 2)));
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
