/** fromage.test.ts - Independent reference, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./fromage";
import type { VisualFrame } from "@/types";

interface Input {
    target: number[];
    initial: number[];
    steps: number;
    learningRate: number;
    weightDecay: number;
}

function norm(v: number[]): number {
    return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function objective(theta: number[], target: number[]): number {
    return theta.reduce((s, v, i) => s + 0.5 * (v - (target[i] ?? 0)) ** 2, 0);
}

function reference(input: Input) {
    const theta = input.initial.slice();
    const ratios: number[] = [];
    for (let t = 0; t < input.steps; t += 1) {
        const grad = theta.map((v, i) => v - (input.target[i] ?? 0));
        const wn = norm(theta);
        const gn = norm(grad);
        const ratio = gn < 1e-12 || wn < 1e-12 ? 1 : Math.min(1e6, Math.max(1e-6, wn / gn));
        ratios.push(ratio);
        for (let i = 0; i < theta.length; i += 1) {
            theta[i] = (theta[i] ?? 0) - input.learningRate * ratio * ((grad[i] ?? 0) + input.weightDecay * (theta[i] ?? 0));
        }
    }
    return { theta, ratios, objective: objective(theta, input.target) };
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

describe("FROMAGE optimizer", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent update loop", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.target.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const weights = final?.["weights"] as number[];
        expect(weights.length).toBe(expected.theta.length);
        weights.forEach((value, i) => expect(value).toBeCloseTo(expected.theta[i] ?? 0, 9));
        expect(final?.["objective"]).toBeCloseTo(expected.objective, 9);
        expect(Number(final?.["objective"])).toBeLessThan(0.1);
        expect(Number(final?.["objective"])).toBeLessThan(Number(frames[0]?.meta["objective"]) * 0.5);
    });

    it("reports the correct trust ratio on the first step", () => {
        const frames = [...mod.run({ ...input, steps: 1 })];
        const first = frames[1]?.meta;
        const theta = input.initial.map((v, i) => v - (input.target[i] ?? 0));
        const gn = norm(theta);
        const wn = norm(input.initial);
        const ratio = gn < 1e-12 || wn < 1e-12 ? 1 : wn / gn;
        expect(Number(first?.["trustRatio"])).toBeCloseTo(ratio, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
