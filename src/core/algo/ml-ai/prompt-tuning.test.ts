/**
 * prompt-tuning.test.ts - Brute-force gradient, frozen-weight, and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { promptForward, promptGradient, promptLoss } from "./prompt-tuning";
import type { VisualFrame } from "@/types";

type Matrix = number[][];

function checkFrames(frames: VisualFrame[], expectedCells: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(expectedCells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => typeof e.metadata["row"] === "number" && typeof e.metadata["col"] === "number")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.meta["prompt"])).toBe(true);
        expect(Array.isArray(frame.meta["lossHistory"])).toBe(true);
    });
}

describe("Soft prompt tuning", () => {
    it("matches a direct forward computation", () => {
        const tokens = [
            [0.3, -0.2],
            [0.1, 0.4],
        ];
        const prompt = [[0.5, -0.1]];
        const weights = [
            [1, 0.5],
            [-0.5, 1],
        ];
        const bias = [0.1, -0.2];
        const result = promptForward(tokens, prompt, weights, bias);
        const joined = [...prompt, ...tokens];
        const h0 = joined.reduce((s, r) => s + r[0], 0) / joined.length;
        const h1 = joined.reduce((s, r) => s + r[1], 0) / joined.length;
        expect(result.pooled[0]).toBeCloseTo(h0, 12);
        expect(result.pooled[1]).toBeCloseTo(h1, 12);
        expect(result.logits[0]).toBeCloseTo(h0 + 0.5 * h1 + 0.1, 12);
        expect(result.logits[1]).toBeCloseTo(-0.5 * h0 + h1 - 0.2, 12);
        expect(result.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    });

    it("matches a finite-difference gradient", () => {
        const input = mod.defaultInput as {
            examples: number[][][];
            labels: number[];
            weights: Matrix;
            bias: number[];
            prompt: Matrix;
        };
        const eps = 1e-6;
        const analytic = promptGradient(input.examples, input.labels, input.prompt, input.weights, input.bias);
        for (let r = 0; r < input.prompt.length; r += 1) {
            for (let c = 0; c < (input.prompt[r]?.length ?? 0); c += 1) {
                const plus = input.prompt.map((row) => [...row]);
                const minus = input.prompt.map((row) => [...row]);
                plus[r][c] += eps;
                minus[r][c] -= eps;
                const numeric =
                    (promptLoss(input.examples, input.labels, plus, input.weights, input.bias) -
                        promptLoss(input.examples, input.labels, minus, input.weights, input.bias)) /
                    (2 * eps);
                expect(analytic[r]?.[c]).toBeCloseTo(numeric, 5);
            }
        }
    });

    it("lowers the loss without touching the frozen weights", () => {
        const input = mod.defaultInput as {
            examples: number[][][];
            labels: number[];
            weights: Matrix;
            bias: number[];
            prompt: Matrix;
            steps: number;
        };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, input.prompt.length * (input.prompt[0]?.length ?? 0));
        const first = frames[0]?.meta;
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["loss"])).toBeLessThan(Number(first?.["loss"]));
        expect(Number(last?.["accuracy"])).toBe(1);
        expect(last?.["weightsChecksum"]).toBe(first?.["weightsChecksum"]);
        expect(input.prompt[0]?.[0]).toBeCloseTo(0.6, 12);
        expect(input.weights.flat().reduce((a, b) => a + b, 0)).toBe(0);
        expect(Math.abs((last?.["prompt"] as Matrix)[0]?.[0] ?? 1)).toBeLessThan(0.25);
    });

    it("terminates cleanly", () => {
        const generator = mod.run({ steps: 3, prompt: [[0.3, 0]] });
        const frames = [...generator];
        expect(frames.length).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
