/** amsgrad.test.ts - Independent update check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./amsgrad";
import type { VisualFrame } from "@/types";

interface Input {
    parameters: number[];
    gradients: number[][];
    learningRate: number;
    beta1: number;
    beta2: number;
    epsilon: number;
}

function reference(input: Input): number[] {
    const theta = input.parameters.slice();
    const m = theta.map(() => 0);
    const v = theta.map(() => 0);
    const vMax = theta.map(() => 0);
    for (let t = 0; t < input.gradients.length; t += 1) {
        const g = input.gradients[t];
        const timeStep = t + 1;
        for (let i = 0; i < theta.length; i += 1) {
            m[i] = input.beta1 * m[i] + (1 - input.beta1) * g[i];
            v[i] = input.beta2 * v[i] + (1 - input.beta2) * g[i] * g[i];
            vMax[i] = Math.max(vMax[i], v[i]);
            const mHat = m[i] / (1 - Math.pow(input.beta1, timeStep));
            theta[i] -= (input.learningRate * mHat) / (Math.sqrt(vMax[i]) + input.epsilon);
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

describe("AMSGrad Optimizer", () => {
    const input: Input = {
        parameters: [1, -1, 0.5, -0.5],
        gradients: [
            [1.0, -0.8, 0.3, -0.2],
            [0.2, -0.1, 0.05, -0.02],
            [0.6, -0.5, 0.2, -0.1],
            [0.1, -0.05, 0.01, -0.005],
        ],
        learningRate: 0.1,
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8,
    };

    it("matches an independent AMSGrad replay", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.parameters.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta["parameters"] as number[];
        for (let i = 0; i < expected.length; i += 1) {
            expect(final[i]).toBeCloseTo(expected[i], 10);
        }
    });

    it("keeps the second-moment maximum monotone", () => {
        const frames = [...mod.run(input)];
        const steps = frames.slice(1, -1);
        for (let s = 1; s < steps.length; s += 1) {
            const current = steps[s]?.meta["vMax"] as number[];
            const previous = steps[s - 1]?.meta["vMax"] as number[];
            for (let i = 0; i < current.length; i += 1) {
                expect(current[i]).toBeGreaterThanOrEqual(previous[i]);
            }
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
