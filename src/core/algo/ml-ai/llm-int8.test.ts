/** llm-int8.test.ts - Quantization accuracy, outlier mask, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { llmInt8 } from "./llm-int8";
import type { VisualFrame } from "@/types";

interface Input {
    x: number[][];
    w: number[][];
    threshold: number;
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBe(rows + 2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(rows);
    });
}

describe("LLM.int8 Quantization", () => {
    const input = mod.defaultInput as Input;

    it("approximates the full-precision product within the reported error", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.x.length);
        const result = llmInt8(input);
        const flat = frames[frames.length - 1]?.meta["output"] as number[];
        const outCols = (frames[frames.length - 1]?.meta["outCols"] as number) ?? (input.w[0]?.length ?? 0);
        const got = (r: number, o: number) => flat[r * outCols + o] ?? 0;
        let maxError = 0;
        input.x.forEach((row, i) => {
            (input.w[0] ?? []).forEach((_, o) => {
                let exact = 0;
                for (let j = 0; j < input.w.length; j += 1) exact += (row[j] ?? 0) * (input.w[j]?.[o] ?? 0);
                maxError = Math.max(maxError, Math.abs(exact - got(i, o)));
                expect(got(i, o)).toBeCloseTo(exact, 1);
            });
        });
        expect(maxError).toBeCloseTo(result.maxAbsError, 10);
        expect(maxError).toBeLessThan(0.01);
    });

    it("identifies outlier columns and keeps normal columns off the list", () => {
        const result = llmInt8(input);
        const expected = input.w.map((_, j) => j).filter((j) => input.x.some((row) => Math.abs(row[j] ?? 0) > input.threshold));
        expect(result.outlierCols).toEqual(expected);
        expect(result.outlierCols).toContain(1);
        expect(result.outlierCols).not.toContain(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
