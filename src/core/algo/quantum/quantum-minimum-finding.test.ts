/**
 * quantum-minimum-finding.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-minimum-finding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], N: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(N);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const norm = (frame.meta["probabilities"] as number[]).reduce((sum, p) => sum + p, 0);
        expect(norm).toBeGreaterThan(0.99);
        expect(norm).toBeLessThan(1.01);
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

describe("Quantum minimum finding", () => {
    it("finds the brute-force minimum on several inputs", () => {
        const cases = [
            [5, 3, 8, 1, 9, 2, 7, 4],
            [2, 2, 2, 2],
            [7],
            [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
            [3, -1, 4, -5, 0, 2],
            [1, 1, 1, 0, 1, 1, 1, 1],
        ];
        for (const values of cases) {
            const N = 2 ** Math.ceil(Math.log2(values.length));
            const frames = [...mod.run({ values })];
            checkFrames(frames, N);
            const metaFrame = finalMeta(frames);
            const expectedMin = Math.min(...values);
            const expectedIndex = values.indexOf(expectedMin);
            expect(metaFrame["bestValue"]).toBe(expectedMin);
            expect(metaFrame["bestIndex"]).toBe(expectedIndex);
            expect(metaFrame["done"]).toBe(true);
        }
    });

    it("keeps best strictly decreasing across measured frames", () => {
        const frames = [...mod.run(mod.defaultInput)];
        let previous = Number.POSITIVE_INFINITY;
        for (const frame of frames) {
            if (frame.meta["phase"] === "measured" || frame.meta["phase"] === "done") {
                const best = Number(frame.meta["bestValue"]);
                expect(best).toBeLessThanOrEqual(previous);
                previous = best;
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThanOrEqual(2);
        expect(generator.next().done).toBe(true);
    });
});
