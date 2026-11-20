/** ledoit-wolf-shrinkage.test.ts - Covariance structure and PSD checks. */

import { describe, expect, it } from "vitest";
import mod from "./ledoit-wolf-shrinkage";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
    });
}

describe("Ledoit-Wolf Shrinkage", () => {
    it("preserves the trace and the symmetric structure", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const sample = final["sample"] as number[][];
        const shrunk = final["shrunk"] as number[][];
        const target = final["target"] as number[][];
        const intensity = Number(final["intensity"]);
        expect(intensity).toBeGreaterThanOrEqual(0);
        expect(intensity).toBeLessThanOrEqual(1);
        const p = sample.length;
        for (let i = 0; i < p; i += 1) {
            for (let j = 0; j < p; j += 1) {
                expect(shrunk[i]![j]!).toBeCloseTo(shrunk[j]![i]!, 12);
                expect(shrunk[i]![j]!).toBeCloseTo(
                    (1 - intensity) * sample[i]![j]! + intensity * target[i]![j]!, 12);
            }
        }
        const traceBefore = sample.reduce((sum, row, i) => sum + row[i]!, 0);
        const traceAfter = shrunk.reduce((sum, row, i) => sum + row[i]!, 0);
        expect(traceAfter).toBeCloseTo(traceBefore, 10);
        expect(traceAfter).toBeCloseTo(Number(final["traceBefore"]), 10);
    });

    it("returns a positive semidefinite matrix under quadratic forms", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const shrunk = frames[frames.length - 1]!.meta["shrunk"] as number[][];
        const p = shrunk.length;
        for (let trial = 0; trial < 200; trial += 1) {
            const v = Array.from({ length: p }, (_, j) => Math.sin(trial * (j + 1) * 0.37));
            let quadratic = 0;
            for (let i = 0; i < p; i += 1) {
                for (let j = 0; j < p; j += 1) quadratic += v[i]! * shrunk[i]![j]! * v[j]!;
            }
            expect(quadratic).toBeGreaterThanOrEqual(-1e-9);
        }
    });

    it("pulls off-diagonal entries toward zero proportionally to the intensity", () => {
        const data = [
            [1, 2], [2, 3.1], [3, 4], [4, 5.2], [5, 6], [6, 7.1], [7, 8], [8, 9],
        ];
        const frames = [...mod.run({ data })];
        const final = frames[frames.length - 1]!.meta;
        const sample = final["sample"] as number[][];
        const shrunk = final["shrunk"] as number[][];
        const intensity = Number(final["intensity"]);
        expect(shrunk[0]![1]!).toBeCloseTo((1 - intensity) * sample[0]![1]!, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
