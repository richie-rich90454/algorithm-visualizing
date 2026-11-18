/**
 * cholesky-decomposition.test.ts - Reconstruction brute force, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cholesky-decomposition";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n);
    });
}

function toMatrix(flat: number[], n: number): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        out.push(flat.slice(i * n, (i + 1) * n));
    }
    return out;
}

/** Brute-force check that L times its transpose reconstructs A. */
function reconstructionError(a: number[][], l: number[][]): number {
    let worst = 0;
    const n = a.length;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let k = 0; k < n; k += 1) {
                sum += (l[i]?.[k] ?? 0) * (l[j]?.[k] ?? 0);
            }
            worst = Math.max(worst, Math.abs(sum - (a[i]?.[j] ?? 0)));
        }
    }
    return worst;
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

function spd(n: number, seed: number): number[][] {
    const random = rng(seed);
    const m = Array.from({ length: n }, () => Array.from({ length: n }, () => random() * 2 - 1));
    const a = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let k = 0; k < n; k += 1) {
                sum += (m[i]?.[k] ?? 0) * (m[j]?.[k] ?? 0);
            }
            a[i]![j] = sum + (i === j ? n : 0);
        }
    }
    return a;
}

describe("Cholesky decomposition", () => {
    it("reconstructs the default matrix exactly within tolerance", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const n = 3;
        checkFrames(frames, n);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["success"]).toBe(true);
        const l = toMatrix(last?.["factor"] as number[], n);
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                expect(l[i]?.[j]).toBe(0);
            }
            expect(l[i]?.[i] ?? 0).toBeGreaterThan(0);
        }
        const defaultMatrix = (mod.defaultInput as { matrix: number[][] }).matrix;
        expect(reconstructionError(defaultMatrix, l)).toBeLessThan(1e-10);
    });

    it("factors many random positive-definite matrices", () => {
        for (const n of [2, 3, 4, 5]) {
            for (const seed of [1, 5, 11, 23, 77]) {
                const matrix = spd(n, seed);
                const frames = [...mod.run({ matrix })];
                checkFrames(frames, n);
                const last = frames[frames.length - 1]?.meta;
                expect(last?.["success"]).toBe(true);
                const l = toMatrix(last?.["factor"] as number[], n);
                expect(reconstructionError(matrix, l)).toBeLessThan(1e-8);
                expect(Number(last?.["maxError"])).toBeLessThan(1e-8);
            }
        }
    });

    it("reports failure on a non-positive-definite matrix", () => {
        const matrix = [
            [1, 2],
            [2, 1],
        ];
        const frames = [...mod.run({ matrix })];
        checkFrames(frames, 2);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["success"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
