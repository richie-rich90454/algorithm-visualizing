/** swiglu-activation.test.ts - Definition, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { swigluForward } from "./swiglu-activation";
import type { VisualFrame } from "@/types";

interface Input {
    x: number[][];
    w1: number[][];
    w2: number[][];
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBe(rows + 2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(rows);
    });
}

describe("SwiGLU Activation", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force SwiGLU computation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.x.length);
        const flat = frames[frames.length - 1]?.meta["outputs"] as number[];
        const outCols = (frames[frames.length - 1]?.meta["outCols"] as number) ?? 1;
        const got = (r: number, j: number) => flat[r * outCols + j] ?? 0;
        input.x.forEach((row, r) => {
            const expected = (input.w1[0] ?? []).map((_, j) => {
                let a = 0;
                let b = 0;
                for (let i = 0; i < row.length; i += 1) {
                    a += (row[i] ?? 0) * (input.w1[i]?.[j] ?? 0);
                    b += (row[i] ?? 0) * (input.w2[i]?.[j] ?? 0);
                }
                const s = b / (1 + Math.exp(-b));
                return a * s;
            });
            expected.forEach((v, j) => expect(got(r, j)).toBeCloseTo(v, 12));
        });
    });

    it("agrees with the exported helper and is odd in the gate for zero up", () => {
        const rows = swigluForward(input.x, input.w1, input.w2);
        const frames = [...mod.run(input)];
        const flat = frames[frames.length - 1]?.meta["outputs"] as number[];
        const outCols = (frames[frames.length - 1]?.meta["outCols"] as number) ?? 1;
        rows.forEach((row, r) => row.output.forEach((v, j) => expect(flat[r * outCols + j] ?? 0).toBeCloseTo(v, 12)));
        const zeroUp = swigluForward([[1]], [[0]], [[2]]);
        const negUp = swigluForward([[1]], [[0]], [[-2]]);
        expect(zeroUp[0]?.output[0]).toBeCloseTo(0, 12);
        expect(negUp[0]?.output[0]).toBeCloseTo(0, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
