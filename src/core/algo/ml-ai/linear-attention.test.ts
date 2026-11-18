/**
 * linear-attention.test.ts - Fast versus pairwise kernel equivalence, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { featureMap, linearAttentionFast, linearAttentionSlow } from "./linear-attention";
import type { VisualFrame } from "@/types";

type Input = { queries: number[][]; keys: number[][]; values: number[][] };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("LinearAttention", () => {
    it("uses a strictly positive feature map", () => {
        for (const v of [-10, -2, -0.1, 0, 0.5, 3]) {
            expect(featureMap([v])[0] ?? 0).toBeGreaterThan(0);
        }
        expect(featureMap([0])[0]).toBe(1);
        expect(featureMap([2])[0]).toBe(3);
    });

    it("fast summary form matches the explicit pairwise kernel form", () => {
        const cases: Input[] = [
            {
                queries: [[1, 0], [0, 1]],
                keys: [[1, 0], [0, 1], [0.5, 0.5]],
                values: [[2, 0], [0, 3], [1, 1]],
            },
            {
                queries: [[0.4, -0.9], [1.3, 0.2], [-1, 1], [0, 0]],
                keys: [[1, 0.2], [-0.5, 1], [0.7, 0.7], [0, -1], [2, 0.1]],
                values: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]],
            },
            {
                queries: [[1, 2, 0.5]],
                keys: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]],
                values: [[1, 0], [0, 1], [1, 1], [2, 2]],
            },
        ];
        for (const input of cases) {
            const fast = linearAttentionFast(input.queries, input.keys, input.values);
            const slow = linearAttentionSlow(input.queries, input.keys, input.values);
            expect(fast.output).toHaveLength(slow.length);
            fast.output.forEach((row, i) =>
                row.forEach((v, j) => expect(v).toBeCloseTo(slow[i]?.[j] ?? 0, 9)),
            );
        }
    });

    it("reproduces the helper output in the final frame", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = linearAttentionFast(input.queries, input.keys, input.values).output;
        const flat = expected.reduce<number[]>((acc, row) => acc.concat(row), []);
        const metaOutput = frames[frames.length - 1]?.meta["output"] as number[];
        expect(metaOutput).toHaveLength(flat.length);
        flat.forEach((v, i) => expect(metaOutput[i] ?? 0).toBeCloseTo(v, 9));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
