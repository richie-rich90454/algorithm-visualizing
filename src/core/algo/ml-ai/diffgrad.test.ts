/**
 * diffgrad.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./diffgrad";
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
        learningRate: typeof task.learningRate === "number" ? task.learningRate : 0.3,
        beta1: typeof task.beta1 === "number" ? task.beta1 : 0.9,
        beta2: typeof task.beta2 === "number" ? task.beta2 : 0.999,
        epsilon: typeof task.epsilon === "number" ? task.epsilon : 1e-8,
    };
}

/** Independent reference implementation of the DiffGrad update rule. */
function reference(cfg: OptInput): { weight: number; loss: number; factors: number[] } {
    let w = cfg.start;
    let m = 0;
    let v = 0;
    let prev = 0;
    const factors: number[] = [];
    for (let i = 0; i < cfg.iterations; i += 1) {
        const g = 2 * (w - cfg.target);
        m = cfg.beta1 * m + (1 - cfg.beta1) * g;
        v = cfg.beta2 * v + (1 - cfg.beta2) * g * g;
        const f = 1 / (1 + Math.exp(-Math.abs(g - prev)));
        factors.push(f);
        w -= (cfg.learningRate * f * m) / (Math.sqrt(v) + cfg.epsilon);
        prev = g;
    }
    return { weight: w, loss: (w - cfg.target) ** 2, factors };
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

describe("DiffGrad optimizer", () => {
    it("matches an independent reference across several inputs", () => {
        const cases: Array<Partial<OptInput>> = [
            { target: 3, start: 0, iterations: 30, learningRate: 0.3 },
            { target: -2, start: 5, iterations: 20, learningRate: 0.2, beta1: 0.8 },
            { target: 1, start: 1, iterations: 5, learningRate: 0.5 },
        ];
        for (const partial of cases) {
            const cfg = resolve({ ...(mod.defaultInput as object), ...partial });
            const frames = [...mod.run(cfg)];
            checkFrames(frames);
            const expected = reference(cfg);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(Number(finalMeta?.["weight"])).toBeCloseTo(expected.weight, 10);
            expect(Number(finalMeta?.["loss"])).toBeCloseTo(expected.loss, 10);
        }
    });

    it("moves the weight toward the target and reports sigmoid factors in range", () => {
        const cfg = resolve(mod.defaultInput);
        const frames = [...mod.run(cfg)];
        const finalWeight = Number(frames[frames.length - 1]?.meta["weight"]);
        expect(Math.abs(finalWeight - cfg.target)).toBeLessThan(Math.abs(cfg.start - cfg.target));
        for (const frame of frames) {
            if (frame.stepNumber === 0) {
                continue;
            }
            const factor = Number(frame.meta["factor"]);
            expect(factor).toBeGreaterThan(0);
            expect(factor).toBeLessThan(1);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
