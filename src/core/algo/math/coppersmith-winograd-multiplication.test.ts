/** coppersmith-winograd-multiplication.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./coppersmith-winograd-multiplication";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function naive(a: number[], b: number[]): number[] {
    const out = Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) out[i + j] += a[i]! * b[j]!;
    }
    return out;
}

describe("Coppersmith-Winograd multiplication", () => {
    it("matches naive convolution across sizes", () => {
        for (let la = 1; la <= 9; la += 1) {
            for (let lb = 1; lb <= 9; lb += 1) {
                const a = Array.from({ length: la }, (_, i) => ((i * 5 + la) % 13) - 6);
                const b = Array.from({ length: lb }, (_, i) => ((i * 3 + lb) % 11) - 5);
                const frames = [...mod.run({ a, b })];
                checkFrames(frames);
                const result = frames[frames.length - 1]?.meta["result"] as number[];
                expect(result).toEqual(naive(a, b));
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
