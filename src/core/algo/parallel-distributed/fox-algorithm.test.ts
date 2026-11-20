/**
 * fox-algorithm.test.ts - Naive matrix-multiply cross-check and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./fox-algorithm";
import type { VisualFrame } from "@/types";

function naive(a: number[][], b: number[][]): number[] {
    const n = a.length;
    const out: number[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let k = 0; k < n; k += 1) {
                sum += (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0);
            }
            out.push(sum);
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Fox block matrix multiplication", () => {
    it("matches naive multiplication on the default input", () => {
        const input = mod.defaultInput as { a: number[][]; b: number[][] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["result"]).toEqual(naive(input.a, input.b));
    });

    it("matches naive multiplication on random 4x4 matrices", () => {
        let seed = 23;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483647;
            return seed / 2147483647;
        };
        for (let t = 0; t < 8; t += 1) {
            const a = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Math.floor(rand() * 9) - 4));
            const b = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Math.floor(rand() * 9) - 4));
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            expect(frames[frames.length - 1]!.meta["result"]).toEqual(naive(a, b));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
