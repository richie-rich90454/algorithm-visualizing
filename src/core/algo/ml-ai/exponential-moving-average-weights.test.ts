/** exponential-moving-average-weights.test.ts - Reference and property checks. */

import { describe, expect, it } from "vitest";
import mod from "./exponential-moving-average-weights";
import type { VisualFrame } from "@/types";

interface Input {
    target: number[];
    steps: number;
    decay: number;
    amplitude: number;
}

function mse(a: number[], b: number[]): number {
    return a.reduce((s, v, i) => s + (v - (b[i] ?? 0)) ** 2, 0) / a.length;
}

function liveAt(target: number[], amplitude: number, t: number): number[] {
    return target.map((center, i) => center + amplitude * Math.sin((t + 1) * (i + 1) * 0.55 + i));
}

function reference(input: Input) {
    let shadow = liveAt(input.target, input.amplitude, 0);
    let live = shadow.slice();
    for (let t = 1; t <= input.steps; t += 1) {
        live = liveAt(input.target, input.amplitude, t);
        shadow = shadow.map((v, i) => input.decay * v + (1 - input.decay) * (live[i] ?? 0));
    }
    return { live, shadow, mseLive: mse(live, input.target), mseShadow: mse(shadow, input.target) };
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

describe("Exponential moving average of weights", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent EMA recurrence", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.target.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const shadow = final?.["shadow"] as number[];
        shadow.forEach((value, i) => expect(value).toBeCloseTo(expected.shadow[i] ?? 0, 9));
        expect(Number(final?.["mseShadow"])).toBeCloseTo(expected.mseShadow, 9);
    });

    it("smooths the trajectory so the shadow has lower error", () => {
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["mseShadow"])).toBeLessThan(Number(final?.["mseLive"]));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
