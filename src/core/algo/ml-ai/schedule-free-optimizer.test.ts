/** schedule-free-optimizer.test.ts - Reference trajectory, convergence, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { scheduleFreeRun } from "./schedule-free-optimizer";
import type { VisualFrame } from "@/types";

interface Input {
    target: number[];
    x0: number[];
    lr: number;
    beta: number;
    beta1: number;
    beta2: number;
    weightDecay: number;
    steps: number;
}

function checkFrames(frames: VisualFrame[], steps: number, d: number): void {
    expect(frames.length).toBe(steps + 2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(steps * d);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(steps);
    });
}

/** Independent Schedule-Free AdamW trajectory on the same quadratic. */
function reference(input: Input) {
    let z = [...input.x0];
    let x = [...input.x0];
    let m = input.x0.map(() => 0);
    let v = input.x0.map(() => 0);
    const xs: number[][] = [];
    for (let t = 1; t <= input.steps; t += 1) {
        const y = z.map((zi, i) => (1 - input.beta) * zi + input.beta * x[i]!);
        const g = y.map((yi, i) => yi - input.target[i]!);
        m = g.map((gi, i) => input.beta1 * m[i]! + (1 - input.beta1) * gi);
        v = g.map((gi, i) => input.beta2 * v[i]! + (1 - input.beta2) * gi * gi);
        z = z.map((zi, i) => {
            const mHat = m[i]! / (1 - Math.pow(input.beta1, t));
            const vHat = v[i]! / (1 - Math.pow(input.beta2, t));
            return zi - input.lr * (mHat / (Math.sqrt(vHat) + 1e-8) + input.weightDecay * zi);
        });
        const c = 1 / t;
        x = x.map((xi, i) => (1 - c) * xi + c * z[i]!);
        xs.push([...x]);
    }
    return xs;
}

describe("Schedule-Free Optimizer", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent reference trajectory", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.steps, input.x0.length);
        const expected = reference(input);
        const log = scheduleFreeRun(input);
        log.forEach((entry, i) => {
            entry.x.forEach((val, j) => expect(val).toBeCloseTo(expected[i]![j]!, 12));
        });
        const got = frames[frames.length - 1]?.meta["x"] as number[];
        expected[expected.length - 1]?.forEach((val, j) => expect(got[j]).toBeCloseTo(val, 12));
    });

    it("drives the averaged iterate toward the quadratic target", () => {
        const log = scheduleFreeRun({ ...input, steps: 400 });
        const final = log[log.length - 1]?.x ?? [];
        final.forEach((v, i) => expect(v).toBeCloseTo(input.target[i] ?? 0, 1));
        const losses = log.map((entry) => entry.loss);
        expect(losses[losses.length - 1]).toBeLessThan(losses[0] ?? Infinity);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
