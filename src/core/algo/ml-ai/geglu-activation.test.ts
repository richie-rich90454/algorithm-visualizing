/** geglu-activation.test.ts - Definition, GELU shape, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { gegluForward, gelu } from "./geglu-activation";
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

describe("GeGLU Activation", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force GeGLU computation", () => {
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
                const inner = Math.sqrt(2 / Math.PI) * (b + 0.044715 * b * b * b);
                return a * (0.5 * b * (1 + Math.tanh(inner)));
            });
            expected.forEach((v, j) => expect(got(r, j)).toBeCloseTo(v, 12));
        });
    });

    it("has the expected GELU shape and agrees with the helper", () => {
        expect(gelu(0)).toBeCloseTo(0, 10);
        expect(gelu(5)).toBeCloseTo(5, 6);
        expect(gelu(-5)).toBeCloseTo(0, 6);
        for (const z of [-2, -0.5, 0.3, 1.4]) {
            const inner = Math.sqrt(2 / Math.PI) * (z + 0.044715 * z * z * z);
            expect(gelu(z)).toBeCloseTo(0.5 * z * (1 + Math.tanh(inner)), 12);
        }
        const rows = gegluForward(input.x, input.w1, input.w2);
        const frames = [...mod.run(input)];
        const flat = frames[frames.length - 1]?.meta["outputs"] as number[];
        const outCols = (frames[frames.length - 1]?.meta["outCols"] as number) ?? 1;
        rows.forEach((row, r) => row.output.forEach((v, j) => expect(flat[r * outCols + j] ?? 0).toBeCloseTo(v, 12)));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
