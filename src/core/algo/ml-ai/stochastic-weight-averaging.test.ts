/** stochastic-weight-averaging.test.ts - Reference and property checks. */

import { describe, expect, it } from "vitest";
import mod from "./stochastic-weight-averaging";
import type { VisualFrame } from "@/types";

interface Input {
    target: number[];
    steps: number;
    cycle: number;
    lrHigh: number;
    lrLow: number;
    noise: number;
}

function objective(theta: number[], target: number[]): number {
    return theta.reduce((s, v, i) => s + 0.5 * (v - (target[i] ?? 0)) ** 2, 0);
}

function reference(input: Input) {
    const theta = input.target.map(() => 0);
    const snapshots: number[][] = [];
    for (let t = 1; t <= input.steps; t += 1) {
        const phase = ((t - 1) % input.cycle) / input.cycle;
        const lr = input.lrLow + 0.5 * (input.lrHigh - input.lrLow) * (1 + Math.cos(Math.PI * phase));
        for (let i = 0; i < theta.length; i += 1) {
            const grad = (theta[i] ?? 0) - (input.target[i] ?? 0);
            const jitter = input.noise * Math.sin((t + 1) * (i + 1) * 0.7);
            theta[i] = (theta[i] ?? 0) - lr * (grad + jitter);
        }
        if (t % input.cycle === 0) snapshots.push(theta.slice());
    }
    const avg = input.target.map((_v, i) => snapshots.reduce((s, snap) => s + (snap[i] ?? 0), 0) / snapshots.length);
    return { theta, snapshots, avg, objective: objective(avg, input.target) };
}

function checkFrames(frames: VisualFrame[], dim: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3 * dim);
        expect(frame.entities.every((e) => e.id.length > 0 && Number.isFinite(e.value as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Stochastic weight averaging", () => {
    const input = mod.defaultInput as Input;

    it("matches the mean of independently recomputed snapshots", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.target.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const avg = final?.["average"] as number[];
        avg.forEach((value, i) => expect(value).toBeCloseTo(expected.avg[i] ?? 0, 9));
        expect(final?.["snapshots"]).toBe(expected.snapshots.length);
        expect(Number(final?.["objectiveAvg"])).toBeCloseTo(expected.objective, 9);
    });

    it("collects one snapshot per cycle", () => {
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["snapshots"]).toBe(Math.floor(input.steps / input.cycle));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
