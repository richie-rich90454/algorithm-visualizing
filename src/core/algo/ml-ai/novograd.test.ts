/**
 * novograd.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./novograd";
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
        learningRate: typeof task.learningRate === "number" ? task.learningRate : 0.1,
        beta1: typeof task.beta1 === "number" ? task.beta1 : 0.95,
        beta2: typeof task.beta2 === "number" ? task.beta2 : 0.999,
        epsilon: typeof task.epsilon === "number" ? task.epsilon : 1e-8,
    };
}

/** Independent reference implementation of the NovoGrad update rule. */
function reference(cfg: OptInput): { weight: number; loss: number; secondMoments: number[] } {
    let w = cfg.start;
    let m = 0;
    let v = 0;
    const secondMoments: number[] = [];
    for (let i = 0; i < cfg.iterations; i += 1) {
        const g = 2 * (w - cfg.target);
        v = cfg.beta2 * v + (1 - cfg.beta2) * g * g;
        secondMoments.push(v);
        const normalized = g / (Math.sqrt(v) + cfg.epsilon);
        m = cfg.beta1 * m + (1 - cfg.beta1) * normalized;
        w -= cfg.learningRate * m;
    }
    return { weight: w, loss: (w - cfg.target) ** 2, secondMoments };
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

describe("NovoGrad optimizer", () => {
    it("matches an independent reference across several inputs", () => {
        const cases: Array<Partial<OptInput>> = [
            { target: 3, start: 0, iterations: 30, learningRate: 0.1 },
            { target: -4, start: 2, iterations: 25, learningRate: 0.2, beta1: 0.9 },
            { target: 0, start: 7, iterations: 12, learningRate: 0.15 },
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

    it("keeps the second moment nonnegative and moves toward the target", () => {
        const cfg = resolve(mod.defaultInput);
        const frames = [...mod.run(cfg)];
        for (const frame of frames) {
            expect(Number(frame.meta["v"])).toBeGreaterThanOrEqual(0);
        }
        const finalWeight = Number(frames[frames.length - 1]?.meta["weight"]);
        expect(Math.abs(finalWeight - cfg.target)).toBeLessThan(Math.abs(cfg.start - cfg.target));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
