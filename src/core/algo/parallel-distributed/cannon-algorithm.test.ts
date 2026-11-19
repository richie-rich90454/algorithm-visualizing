/**
 * cannon-algorithm.test.ts - Brute-force matrix product comparison, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cannon-algorithm";
import type { VisualFrame } from "@/types";

function naive(a: number[][], b: number[][]): number[] {
    const n = a.length;
    const out: number[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let k = 0; k < n; k += 1) sum += (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0);
            out.push(sum);
        }
    }
    return out;
}

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}

function matrix(n: number, rand: () => number): number[][] {
    return Array.from({ length: n }, () => Array.from({ length: n }, () => Math.floor(rand() * 9) - 4));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"] ?? frame.meta["grid"]).toBeDefined();
        for (const e of frame.entities) expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
        expect(frame.edges).toEqual([]);
    });
}

describe("CannonAlgorithm", () => {
    it("matches naive matrix multiplication for random matrices", () => {
        const rand = rng(12345);
        const cases: Array<{ a: number[][]; b: number[][]; grid: number }> = [
            { a: [[1, 2], [3, 4]], b: [[5, 6], [7, 8]], grid: 2 },
            { a: matrix(4, rand), b: matrix(4, rand), grid: 2 },
            { a: matrix(4, rand), b: matrix(4, rand), grid: 1 },
            { a: matrix(6, rand), b: matrix(6, rand), grid: 3 },
        ];
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames);
            expect(frames.at(-1)!.meta["result"]).toEqual(naive(c.a, c.b));
        }
    });

    it("handles the default input and reports the full product", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const input = mod.defaultInput as { a: number[][]; b: number[][] };
        expect(frames.at(-1)!.meta["result"]).toEqual(naive(input.a, input.b));
    });

    it("accumulates monotonically: a later step has at least as much summed value", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const sums = frames
            .filter((f) => f.meta["step"] !== undefined && (f.meta["last"] as string).includes("Shift"))
            .map((f) => f.entities.reduce((s, e) => s + (e.value as number), 0));
        for (let i = 1; i < sums.length; i += 1) expect(sums[i]!).toBeGreaterThanOrEqual(sums[i - 1]!);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(2 + 2 + 1);
        expect(gen.next().done).toBe(true);
    });
});
