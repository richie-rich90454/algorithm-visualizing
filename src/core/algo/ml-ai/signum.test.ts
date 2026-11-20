/** signum.test.ts - Independent reference, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./signum";
import type { VisualFrame } from "@/types";

interface Input {
    target: number[];
    initial: number[];
    steps: number;
    learningRate: number;
    momentum: number;
}

function objective(theta: number[], target: number[]): number {
    return theta.reduce((s, v, i) => s + 0.5 * (v - (target[i] ?? 0)) ** 2, 0);
}

function sign(v: number): number {
    return v > 0 ? 1 : v < 0 ? -1 : 0;
}

function reference(input: Input) {
    const theta = input.initial.slice();
    const m = input.initial.map(() => 0);
    for (let t = 0; t < input.steps; t += 1) {
        for (let i = 0; i < theta.length; i += 1) {
            const grad = (theta[i] ?? 0) - (input.target[i] ?? 0);
            m[i] = input.momentum * (m[i] ?? 0) + grad;
            theta[i] = (theta[i] ?? 0) - input.learningRate * sign(m[i] ?? 0);
        }
    }
    return { theta, m, objective: objective(theta, input.target) };
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

describe("Signum optimizer", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent momentum and sign loop", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.target.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const weights = final?.["weights"] as number[];
        weights.forEach((value, i) => expect(value).toBeCloseTo(expected.theta[i] ?? 0, 9));
        const momentum = final?.["momentum"] as number[];
        momentum.forEach((value, i) => expect(value).toBeCloseTo(expected.m[i] ?? 0, 9));
        expect(final?.["objective"]).toBeCloseTo(expected.objective, 9);
    });

    it("emits sign values restricted to minus one, zero, or one", () => {
        const frames = [...mod.run(input)];
        for (const frame of frames.slice(1, -1)) {
            const signs = frame.meta["signs"] as number[];
            expect(signs.every((s) => s === -1 || s === 0 || s === 1)).toBe(true);
        }
    });

    it("reduces the objective and terminates", () => {
        const generator = mod.run(input);
        const frames = [...generator];
        const initial = Number(frames[0]?.meta["objective"]);
        const final = Number(frames[frames.length - 1]?.meta["objective"]);
        expect(final).toBeLessThan(initial);
        expect(generator.next().done).toBe(true);
    });
});
