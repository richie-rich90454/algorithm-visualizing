/**
 * gram-schmidt.test.ts - Orthonormality and reconstruction properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./gram-schmidt";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(n);
    });
}

function toMatrix(flat: number[], rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, (_, i) => flat.slice(i * cols, (i + 1) * cols));
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

describe("Classical Gram-Schmidt", () => {
    it("produces an orthonormal basis on the default input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["orthError"] as number).toBeLessThan(1e-10);
        const q = toMatrix(last?.["q"] as number[], 3, 3);
        for (let i = 0; i < 3; i += 1) {
            for (let j = 0; j < 3; j += 1) {
                const d = q[i]!.reduce((s, v, k) => s + v * (q[j]?.[k] ?? 0), 0);
                expect(d).toBeCloseTo(i === j ? 1 : 0, 8);
            }
        }
    });

    it("reconstructs the source matrix as Q times R on random inputs", () => {
        for (const seed of [2, 5, 9]) {
            const random = rng(seed);
            const n = 4;
            const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => random() * 2 - 1));
            const frames = [...mod.run({ matrix })];
            checkFrames(frames, n);
            const last = frames[frames.length - 1]?.meta;
            const q = toMatrix(last?.["q"] as number[], n, n);
            const r = toMatrix(last?.["r"] as number[], n, n);
            for (let row = 0; row < n; row += 1) {
                for (let col = 0; col < n; col += 1) {
                    let sum = 0;
                    for (let k = 0; k < n; k += 1) sum += (q[k]?.[col] ?? 0) * (r[k]?.[row] ?? 0);
                    expect(sum).toBeCloseTo(matrix[row]?.[col] ?? 0, 8);
                }
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
