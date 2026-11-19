/** adan-optimizer.test.ts - Independent update check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./adan-optimizer";
import type { VisualFrame } from "@/types";

interface Input {
    parameters: number[];
    gradients: number[][];
    learningRate: number;
    beta1: number;
    beta2: number;
    beta3: number;
    epsilon: number;
    weightDecay: number;
}

function reference(input: Input): number[] {
    const theta = input.parameters.slice();
    const m = theta.map(() => 0);
    const v = theta.map(() => 0);
    const n = theta.map(() => 0);
    const previous = theta.map(() => 0);
    for (const g of input.gradients) {
        for (let i = 0; i < theta.length; i += 1) {
            const diff = g[i] - previous[i];
            m[i] = input.beta1 * m[i] + (1 - input.beta1) * g[i];
            v[i] = input.beta2 * v[i] + (1 - input.beta2) * g[i] * g[i];
            n[i] = input.beta3 * n[i] + (1 - input.beta3) * diff * diff;
            const lookahead = m[i] + input.beta3 * diff;
            theta[i] =
                (1 - input.learningRate * input.weightDecay) * theta[i] -
                (input.learningRate * lookahead) / (Math.sqrt(v[i]) + input.epsilon);
            previous[i] = g[i];
        }
    }
    return theta;
}

function checkFrames(frames: VisualFrame[], d: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(d);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Adan Optimizer", () => {
    const input: Input = {
        parameters: [1, -1, 0.5, -0.5],
        gradients: [
            [0.9, -0.7, 0.3, -0.2],
            [0.5, -0.3, 0.1, -0.1],
            [0.1, -0.05, 0.02, -0.02],
        ],
        learningRate: 0.1,
        beta1: 0.98,
        beta2: 0.999,
        beta3: 0.99,
        epsilon: 1e-8,
        weightDecay: 0,
    };

    it("matches an independent Adan replay", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.parameters.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta["parameters"] as number[];
        for (let i = 0; i < expected.length; i += 1) {
            expect(final[i]).toBeCloseTo(expected[i], 10);
        }
    });

    it("decreases a positive parameter under a constant positive gradient", () => {
        const constant: Input = {
            ...input,
            parameters: [1],
            gradients: [[0.5], [0.5], [0.5]],
        };
        const frames = [...mod.run(constant)];
        const values = frames.slice(0, -1).map((frame) => Number(frame.entities[0]?.value));
        for (let i = 1; i < values.length; i += 1) {
            expect(values[i]).toBeLessThan(values[i - 1]);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(input.gradients.length + 2);
        expect(generator.next().done).toBe(true);
    });
});
