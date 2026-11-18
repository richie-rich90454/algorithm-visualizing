/**
 * diffusion-transformer.test.ts - adaLN math, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./diffusion-transformer";
import type { VisualFrame } from "@/types";

function sigmoid(value: number): number {
    return 1 / (1 + Math.exp(-value));
}

/** Independent recomputation of layer norm plus adaLN modulation. */
function reference(tokens: number[][], cond: number[]) {
    const output: number[][] = [];
    for (const token of tokens) {
        const mean = token.reduce((a, b) => a + b, 0) / token.length;
        const variance = token.reduce((sum, value) => sum + (value - mean) ** 2, 0) / token.length;
        const std = Math.sqrt(variance + 1e-5);
        const row: number[] = [];
        for (let d = 0; d < token.length; d += 1) {
            const x = token[d] ?? 0;
            const c = cond[d] ?? 0;
            const norm = (x - mean) / std;
            row.push(x + sigmoid(c) * (norm * (1 + c) + c * 0.5));
        }
        output.push(row);
    }
    return output;
}

function checkFrames(frames: VisualFrame[], tokens: number, width: number): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * tokens * width);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("DiffusionTransformer", () => {
    it("matches an independent adaLN computation", () => {
        const input = mod.defaultInput as { tokens: number[][]; cond: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.tokens.length, 2);
        const expected = reference(input.tokens, input.cond).flat();
        const output = (frames[frames.length - 1]?.meta["output"] as string[]).map(Number);
        expect(output.length).toBe(expected.length);
        expected.forEach((value, i) => {
            expect(output[i] ?? 0).toBeCloseTo(value, 2);
        });
    });

    it("normalizes tokens to near zero mean and unit variance", () => {
        const tokens = [
            [1, 2, 3],
            [-4, 5, -6],
        ];
        const cond = [0.5, -0.5, 0.2];
        const frames = [...mod.run({ tokens, cond })];
        checkFrames(frames, tokens.length, 3);
        // Rebuild the normalization stage shown in the visualization grid.
        const normCells = frames[2]!.entities.filter((e) => {
            const row = Number(e.metadata["row"]);
            return row >= tokens.length && row < 2 * tokens.length;
        });
        for (let t = 0; t < tokens.length; t += 1) {
            const row = normCells.filter((e) => Number(e.metadata["row"]) === tokens.length + t);
            const values = row.map((e) => Number(e.value));
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            expect(mean).toBeCloseTo(0, 2);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
