/**
 * adahessian.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./adahessian";
import type { VisualFrame } from "@/types";

interface OptInput {
    target: number;
    start: number;
    iterations: number;
    learningRate: number;
    beta1: number;
    beta2: number;
    epsilon: number;
}

function resolve(input: unknown): OptInput {
    const task = (input as Partial<OptInput> | null) ?? {};
    return {
        target: typeof task.target === "number" ? task.target : 3,
        start: typeof task.start === "number" ? task.start : 0,
        iterations: typeof task.iterations === "number" ? Math.max(1, task.iterations) : 30,
        learningRate: typeof task.learningRate === "number" ? task.learningRate : 0.15,
        beta1: typeof task.beta1 === "number" ? task.beta1 : 0.9,
        beta2: typeof task.beta2 === "number" ? task.beta2 : 0.999,
        epsilon: typeof task.epsilon === "number" ? task.epsilon : 1e-8,
    };
}

/** Independent reference: on a quadratic the curvature probe is exactly 2. */
function reference(cfg: OptInput): { weight: number; loss: number } {
    let w = cfg.start;
    let m = 0;
    let v = 0;
    for (let i = 1; i <= cfg.iterations; i += 1) {
        const g = 2 * (w - cfg.target);
        const curvature = 2;
        m = cfg.beta1 * m + (1 - cfg.beta1) * g;
        v = cfg.beta2 * v + (1 - cfg.beta2) * curvature * curvature;
        const mHat = m / (1 - cfg.beta1 ** i);
        const vHat = v / (1 - cfg.beta2 ** i);
        w -= (cfg.learningRate * mHat) / (Math.sqrt(vHat) + cfg.epsilon);
    }
    return { weight: w, loss: (w - cfg.target) ** 2 };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe(mod.visualType);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("AdaHessian optimizer", () => {
    it("matches an independent reference across several inputs", () => {
        const cases: Array<Partial<OptInput>> = [
            { target: 3, start: 0, iterations: 30, learningRate: 0.15 },
            { target: -2, start: 6, iterations: 20, learningRate: 0.2, beta1: 0.8 },
            { target: 1, start: -3, iterations: 15, learningRate: 0.1 },
        ];
        for (const partial of cases) {
            const cfg = resolve({ ...mod.defaultInput, ...partial });
            const frames = [...mod.run(cfg)];
            checkFrames(frames);
            const expected = reference(cfg);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(Number(finalMeta?.["weight"])).toBeCloseTo(expected.weight, 10);
            expect(Number(finalMeta?.["loss"])).toBeCloseTo(expected.loss, 10);
        }
    });

    it("reports an exact positive curvature of two on the quadratic", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames) {
            expect(Number(frame.meta["curvature"])).toBeCloseTo(2, 9);
        }
        const finalWeight = Number(frames[frames.length - 1]?.meta["weight"]);
        expect(Math.abs(finalWeight - 3)).toBeLessThan(3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
