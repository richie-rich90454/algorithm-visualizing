/** lion-optimizer.test.ts - Independent update check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./lion-optimizer";
import type { VisualFrame } from "@/types";

interface Input {
    parameters: number[];
    gradients: number[][];
    learningRate: number;
    beta1: number;
    beta2: number;
    weightDecay: number;
}

/** Independent replay of the Lion recurrence. */
function reference(input: Input): number[] {
    const theta = input.parameters.slice();
    const m = theta.map(() => 0);
    for (const g of input.gradients) {
        for (let i = 0; i < theta.length; i += 1) {
            const c = input.beta1 * m[i] + (1 - input.beta1) * g[i];
            m[i] = input.beta2 * m[i] + (1 - input.beta2) * g[i];
            theta[i] = (1 - input.learningRate * input.weightDecay) * theta[i] - input.learningRate * Math.sign(c);
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

describe("Lion Optimizer", () => {
    const input: Input = {
        parameters: [1, -1, 0.5, -0.5],
        gradients: [
            [0.8, -0.6, 0.2, -0.3],
            [0.4, -0.2, 0.1, -0.1],
            [0.2, -0.1, 0.05, -0.05],
        ],
        learningRate: 0.1,
        beta1: 0.9,
        beta2: 0.99,
        weightDecay: 0,
    };

    it("matches an independent Lion replay", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.parameters.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta["parameters"] as number[];
        expect(final).toHaveLength(expected.length);
        for (let i = 0; i < expected.length; i += 1) {
            expect(final[i]).toBeCloseTo(expected[i], 10);
        }
    });

    it("moves each parameter by exactly the learning rate in magnitude", () => {
        const frames = [...mod.run(input)];
        for (let s = 1; s <= input.gradients.length; s += 1) {
            const before = frames[s - 1]?.entities.map((e) => Number(e.value)) ?? [];
            const after = frames[s]?.entities.map((e) => Number(e.value)) ?? [];
            for (let i = 0; i < before.length; i += 1) {
                expect(Math.abs(after[i] - before[i])).toBeCloseTo(input.learningRate, 10);
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
