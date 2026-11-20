/**
 * adasgd.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./adasgd";
import type { VisualFrame } from "@/types";

interface OptInput {
    target: number;
    start: number;
    iterations: number;
    learningRate: number;
    momentum: number;
    epsilon: number;
}

function resolve(input: unknown): OptInput {
    const task = (input as Partial<OptInput> | null) ?? {};
    return {
        target: typeof task.target === "number" ? task.target : 3,
        start: typeof task.start === "number" ? task.start : 0,
        iterations: typeof task.iterations === "number" ? Math.max(1, task.iterations) : 30,
        learningRate: typeof task.learningRate === "number" ? task.learningRate : 0.5,
        momentum: typeof task.momentum === "number" ? task.momentum : 0.9,
        epsilon: typeof task.epsilon === "number" ? task.epsilon : 1e-8,
    };
}

/** Independent reference implementation of the AdaSGD update rule. */
function reference(cfg: OptInput): { weight: number; loss: number } {
    let w = cfg.start;
    let velocity = 0;
    let accumulated = 0;
    for (let i = 0; i < cfg.iterations; i += 1) {
        const g = 2 * (w - cfg.target);
        velocity = cfg.momentum * velocity + g;
        accumulated += g * g;
        w -= (cfg.learningRate * velocity) / (Math.sqrt(accumulated) + cfg.epsilon);
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

describe("AdaSGD optimizer", () => {
    it("matches an independent reference across several inputs", () => {
        const cases: Array<Partial<OptInput>> = [
            { target: 3, start: 0, iterations: 30, learningRate: 0.5 },
            { target: -2, start: 4, iterations: 20, learningRate: 0.4, momentum: 0.8 },
            { target: 5, start: -1, iterations: 12, learningRate: 0.7 },
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

    it("accumulates squared gradients monotonically and descends", () => {
        const frames = [...mod.run(mod.defaultInput)];
        let previous = 0;
        for (const frame of frames) {
            const accumulated = Number(frame.meta["accumulated"]);
            expect(accumulated).toBeGreaterThanOrEqual(previous);
            previous = accumulated;
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
