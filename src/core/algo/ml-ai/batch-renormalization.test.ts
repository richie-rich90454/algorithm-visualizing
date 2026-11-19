/** batch-renormalization.test.ts - Direct statistics recomputation and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./batch-renormalization";
import type { VisualFrame } from "@/types";

interface Input {
    batch: number[];
    runningMean: number;
    runningVar: number;
    momentum: number;
    rMax: number;
    dMax: number;
    epsilon: number;
}

function mean(a: number[]): number {
    return a.reduce((s, v) => s + v, 0) / a.length;
}
function variance(a: number[]): number {
    const mu = mean(a);
    return a.reduce((s, v) => s + (v - mu) ** 2, 0) / a.length;
}
function clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v));
}

function reference(input: Input) {
    const muB = mean(input.batch);
    const varB = variance(input.batch);
    const stdB = Math.sqrt(varB + input.epsilon);
    const stdRunning = Math.sqrt(input.runningVar + input.epsilon);
    const r = clamp(stdB / stdRunning, 1 / input.rMax, input.rMax);
    const d = clamp((muB - input.runningMean) / stdRunning, -input.dMax, input.dMax);
    const output = input.batch.map((x) => r * ((x - muB) / stdB) + d);
    return { muB, varB, r, d, output };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.entities.every((e) => e.id.length > 0 && Number.isFinite(e.value as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Batch renormalization", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent batch-statistics computation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.batch.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["muB"])).toBeCloseTo(expected.muB, 9);
        expect(Number(final?.["varB"])).toBeCloseTo(expected.varB, 9);
        expect(Number(final?.["r"])).toBeCloseTo(expected.r, 9);
        expect(Number(final?.["d"])).toBeCloseTo(expected.d, 9);
        const trainFrame = frames.find((f) => f.meta["phase"] === 3);
        const output = trainFrame?.meta["output"] as number[];
        output.forEach((value, i) => expect(value).toBeCloseTo(expected.output[i] ?? 0, 9));
    });

    it("gives normalized output mean d and variance r squared", () => {
        const frames = [...mod.run(input)];
        const trainFrame = frames.find((f) => f.meta["phase"] === 3);
        const output = trainFrame?.meta["output"] as number[];
        expect(mean(output)).toBeCloseTo(Number(trainFrame?.meta["d"]), 6);
        expect(Math.abs(variance(output) - Number(trainFrame?.meta["r"]) ** 2)).toBeLessThan(0.01);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
