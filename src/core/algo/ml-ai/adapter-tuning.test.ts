/**
 * adapter-tuning.test.ts - Brute-force forward pass, identity limit, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { adapterForward } from "./adapter-tuning";
import type { VisualFrame } from "@/types";

type Input = { x: number[]; down: number[][]; up: number[][] };

const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);

function reference(x: number[], down: number[][], up: number[][]): number[] {
    const hidden = down.map((row) => Math.max(0, dot(row, x)));
    const delta = up.map((row) => dot(hidden, row));
    return x.map((value, i) => value + (delta[i] ?? 0));
}

function checkFrames(frames: VisualFrame[], d: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Adapter Tuning", () => {
    it("matches a brute-force adapter forward pass", () => {
        const cases: Input[] = [
            {
                x: [1, 2, -1, 0.5],
                down: [[1, 0.5, -0.5, 1], [-0.5, 1, 1, 0.5]],
                up: [[0.5, -0.5], [0.4, 0.3], [0.2, 0.6], [0.1, -0.2]],
            },
            {
                x: [2, -3, 1],
                down: [[0.5, 0, -1], [1, 1, 0.5], [0, -0.5, 2]],
                up: [[1, 0, 0.5], [0, 1, -1], [0.5, 0.5, 1]],
            },
        ];
        for (const c of cases) {
            const got = adapterForward(c.x, c.down, c.up).output;
            const expected = reference(c.x, c.down, c.up);
            got.forEach((v, i) => expect(v).toBeCloseTo(expected[i] ?? 0, 9));
        }
    });

    it("reduces to the identity when adapter matrices are zero", () => {
        const x = [1.5, -2, 3];
        const zeroDown = [[0, 0, 0], [0, 0, 0]];
        const zeroUp = [[0, 0], [0, 0], [0, 0]];
        const out = adapterForward(x, zeroDown, zeroUp).output;
        x.forEach((v, i) => expect(out[i]).toBeCloseTo(v, 12));
    });

    it("reports the final output in metadata and emits well-formed frames", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.x.length);
        const expected = adapterForward(input.x, input.down, input.up).output;
        const metaOutput = frames[frames.length - 1]?.meta["output"] as number[];
        expect(metaOutput).toHaveLength(expected.length);
        expected.forEach((v, i) => expect(metaOutput[i] ?? 0).toBeCloseTo(v, 6));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
