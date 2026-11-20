/**
 * stylegan2.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./stylegan2";
import type { VisualFrame } from "@/types";

type Input = { weights: number[][]; styles: number[]; eps: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function bruteForceDemod(weights: number[][], styles: number[], eps: number): number[][] {
    return weights.map((row, i) => {
        const style = styles[i] ?? 1;
        const modulated = row.map((v) => v * style);
        const power = modulated.reduce((a, v) => a + v * v, 0);
        const denom = Math.sqrt(power + eps);
        return modulated.map((v) => v / denom);
    });
}

describe("StyleGAN2 Weight Demodulation", () => {
    it("matches brute-force demodulation and gives unit norm per feature", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = bruteForceDemod(input.weights, input.styles, input.eps);
        const final = frames[frames.length - 1]?.meta;
        const demodulated = final?.["demodulated"] as number[];
        const norms = final?.["rowNorms"] as number[];
        let index = 0;
        expected.forEach((row) => {
            let power = 0;
            row.forEach((value) => {
                expect(demodulated[index]).toBeCloseTo(value, 5);
                power += value * value;
                index += 1;
            });
            expect(Math.sqrt(power)).toBeCloseTo(1, 5);
        });
        norms.forEach((norm) => expect(norm).toBeCloseTo(1, 5));
    });

    it("the result is invariant to the style magnitude up to rounding", () => {
        const weights = [[1, 2, 1]];
        const small = [...mod.run({ weights, styles: [0.5], eps: 1e-8 })];
        const large = [...mod.run({ weights, styles: [5], eps: 1e-8 })];
        const a = small[small.length - 1]?.meta["demodulated"] as number[];
        const b = large[large.length - 1]?.meta["demodulated"] as number[];
        a.forEach((value, i) => expect(value).toBeCloseTo(b[i] ?? 0, 5));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
