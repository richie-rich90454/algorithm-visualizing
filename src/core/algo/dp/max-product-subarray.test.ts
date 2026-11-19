/**
 * max-product-subarray.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./max-product-subarray";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function brute(values: number[]): { best: number; start: number; end: number } {
    let best = values[0] as number;
    let start = 0;
    let end = 0;
    for (let i = 0; i < values.length; i += 1) {
        let product = 1;
        for (let j = i; j < values.length; j += 1) {
            product *= values[j] as number;
            if (product > best) {
                best = product;
                start = i;
                end = j;
            }
        }
    }
    return { best, start, end };
}

function resultOf(values: number[]) {
    const frames = [...mod.run({ values })];
    checkFrames(frames);
    const meta = frames[frames.length - 1]?.meta ?? {};
    return {
        best: meta["best"] as number,
        start: meta["bestStart"] as number,
        end: meta["bestEnd"] as number,
    };
}

describe("Maximum Product Subarray", () => {
    it("matches brute force on hand-picked sign patterns", () => {
        const cases: number[][] = [
            [2, 3, -2, 4, -1, 5, -3, 2],
            [-2, 3, -4],
            [0, 0, 0, 0],
            [-1, -2, -3, -4],
            [5],
            [1, 2, 0, -3, 4, 5],
            [-2, 0, -1],
        ];
        for (const values of cases) {
            const got = resultOf(values);
            const want = brute(values);
            expect(got.best).toBe(want.best);
            let product = 1;
            for (let i = got.start; i <= got.end; i += 1) product *= values[i] as number;
            expect(product).toBe(want.best);
        }
    });

    it("matches brute force on randomized arrays", () => {
        let seed = 987;
        const rand = () => {
            seed = (1103515245 * seed + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const n = 1 + Math.floor(rand() * 10);
            const values = Array.from({ length: n }, () => Math.floor(rand() * 11) - 5);
            expect(resultOf(values).best).toBe(brute(values).best);
        }
    });

    it("handles the empty array", () => {
        const frames = [...mod.run({ values: [] })];
        expect(frames.length).toBeGreaterThan(0);
        expect(frames[frames.length - 1]?.meta["bestEnd"]).toBe(-1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
