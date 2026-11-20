/** synthesizer.test.ts - Brute-force attention, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { synthesize } from "./synthesizer";
import type { VisualFrame } from "@/types";

interface Input {
    x: number[][];
    w1: number[][];
    w2: number[][];
    v: number[][];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(2);
    });
}

function mul(a: number[][], b: number[][]): number[][] {
    return a.map((row) => (b[0] ?? []).map((_, j) => row.reduce((acc, v, i) => acc + v * (b[i]?.[j] ?? 0), 0)));
}

describe("Synthesizer Attention", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force synthesized attention computation", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const logits = mul(mul(input.x, input.w1), input.w2);
        const weights = logits.map((row) => {
            const max = Math.max(...row);
            const exps = row.map((v) => Math.exp(v - max));
            const sum = exps.reduce((a, b) => a + b, 0);
            return exps.map((e) => e / sum);
        });
        const expected = mul(weights, input.v);
        const flat = frames[frames.length - 1]?.meta["output"] as number[];
        const outCols = (frames[frames.length - 1]?.meta["outCols"] as number) ?? (input.v[0]?.length ?? 0);
        const got = (r: number, c: number) => flat[r * outCols + c] ?? 0;
        expected.forEach((row, r) => row.forEach((v, c) => expect(got(r, c)).toBeCloseTo(v, 12)));
        const helper = synthesize(input);
        helper.output.forEach((row, r) => row.forEach((v, c) => expect(got(r, c)).toBeCloseTo(v, 12)));
    });

    it("has softmax weight rows that sum to one", () => {
        const result = synthesize(input);
        result.weights.forEach((row) => expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
