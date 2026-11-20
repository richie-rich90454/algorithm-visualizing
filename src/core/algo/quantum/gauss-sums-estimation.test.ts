/**
 * gauss-sums-estimation.test.ts - Independent Gauss sum recomputation,
 * magnitude identity checks, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./gauss-sums-estimation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent direct evaluation of the defining Gauss sum. */
function reference(a: number, n: number): { real: number; imag: number } {
    let real = 0;
    let imag = 0;
    for (let x = 0; x < n; x += 1) {
        real += Math.cos((2 * Math.PI * a * x * x) / n);
        imag += Math.sin((2 * Math.PI * a * x * x) / n);
    }
    return { real, imag };
}

describe("Quantum Gauss Sum Estimation", () => {
    it("matches an independent term-by-term recomputation", () => {
        for (const [a, n] of [[1, 5], [2, 7], [3, 8], [1, 12]]) {
            const frames = [...mod.run({ a, n })];
            checkFrames(frames, n);
            const last = frames[frames.length - 1]!.meta;
            const ref = reference(a, n);
            expect(Number(last["real"])).toBeCloseTo(ref.real, 9);
            expect(Number(last["imag"])).toBeCloseTo(ref.imag, 9);
        }
    });

    it("satisfies the classical magnitude identities for coprime inputs", () => {
        const cases: Array<[number, number, number]> = [
            [1, 5, Math.sqrt(5)],
            [2, 9, 3],
            [1, 8, Math.sqrt(16)],
            [5, 12, Math.sqrt(24)],
            [1, 6, 0],
        ];
        for (const [a, n, expected] of cases) {
            const frames = [...mod.run({ a, n })];
            checkFrames(frames, n);
            const last = frames[frames.length - 1]!.meta;
            expect(Number(last["magnitude"])).toBeCloseTo(expected, 8);
        }
    });

    it("reports phase in the principal range", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 5);
        for (const frame of frames) {
            const phase = Number(frame.meta["phase"]);
            expect(phase).toBeGreaterThanOrEqual(-Math.PI);
            expect(phase).toBeLessThanOrEqual(Math.PI);
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
