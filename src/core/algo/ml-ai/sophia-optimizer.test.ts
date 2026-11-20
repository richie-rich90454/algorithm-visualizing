/** sophia-optimizer.test.ts - Independent update loop, clipping, and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./sophia-optimizer";
import type { VisualFrame } from "@/types";

interface Input {
    target: number[];
    curvature: number[];
    initial: number[];
    steps: number;
    learningRate: number;
    beta1: number;
}

function objective(theta: number[], target: number[], h: number[]): number {
    return theta.reduce((s, v, i) => s + 0.5 * (h[i] ?? 1) * (v - (target[i] ?? 0)) ** 2, 0);
}

function reference(input: Input) {
    const theta = input.initial.slice();
    const m = input.initial.map(() => 0);
    const allUpdates: number[][] = [];
    for (let t = 0; t < input.steps; t += 1) {
        const update: number[] = [];
        const biasCorrection = 1 - input.beta1 ** (t + 1);
        for (let i = 0; i < theta.length; i += 1) {
            const grad = (input.curvature[i] ?? 1) * ((theta[i] ?? 0) - (input.target[i] ?? 0));
            m[i] = input.beta1 * (m[i] ?? 0) + (1 - input.beta1) * grad;
            const clipped = Math.min(1, Math.max(-1, (m[i] ?? 0) / biasCorrection / ((input.curvature[i] ?? 1) + 1e-8)));
            update.push(clipped);
            theta[i] = (theta[i] ?? 0) - input.learningRate * clipped;
        }
        allUpdates.push(update);
    }
    return { theta, allUpdates, objective: objective(theta, input.target, input.curvature) };
}

function checkFrames(frames: VisualFrame[], dim: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2 * dim);
        expect(frame.entities.every((e) => e.id.length > 0 && Number.isFinite(e.value as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Sophia optimizer", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent preconditioned update loop", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.target.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const weights = final?.["weights"] as number[];
        weights.forEach((value, i) => expect(value).toBeCloseTo(expected.theta[i] ?? 0, 9));
        expect(final?.["objective"]).toBeCloseTo(expected.objective, 9);
        expect(Number(final?.["objective"])).toBeLessThan(1e-3);
    });

    it("never emits an update outside the clipping range", () => {
        const frames = [...mod.run(input)];
        for (const frame of frames.slice(1, -1)) {
            const update = frame.meta["update"] as number[];
            expect(update.every((v) => v >= -1 && v <= 1)).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
