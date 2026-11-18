/**
 * adagrad.test.ts - Independent AdaGrad reference, descent property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./adagrad";
import type { VisualFrame } from "@/types";

interface Input {
    start: number[];
    target: number[];
    curvature: number;
    lr: number;
    eps: number;
    iterations: number;
}

/** Independent reimplementation of the AdaGrad update sequence. */
function reference(input: Input): number[][] {
    const w = input.start.slice();
    const [a, b] = input.target;
    const accum = w.map(() => 0);
    const path = [w.slice()];
    for (let t = 0; t < input.iterations; t += 1) {
        const g = [(w[0] ?? 0) - (a ?? 0), input.curvature * ((w[1] ?? 0) - (b ?? 0))];
        for (let d = 0; d < w.length; d += 1) {
            const gv = g[d] ?? 0;
            accum[d] = (accum[d] ?? 0) + gv * gv;
            w[d] = (w[d] ?? 0) - (input.lr * gv) / (Math.sqrt(accum[d] ?? 0) + input.eps);
        }
        path.push(w.slice());
    }
    return path;
}

function checkFrames(frames: VisualFrame[], maxEntities: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(Math.min(index + 1, maxEntities));
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(typeof frame.meta["loss"]).toBe("number");
    });
}

describe("AdaGrad", () => {
    it("matches an independent reference step for step", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.iterations + 1);
        const expected = reference(input);
        for (let t = 0; t < expected.length; t += 1) {
            const meta = frames[t]?.meta;
            expect(meta?.["w0"]).toBeCloseTo(expected[t]?.[0] ?? 0, 9);
            expect(meta?.["w1"]).toBeCloseTo(expected[t]?.[1] ?? 0, 9);
        }
    });

    it("monotonically decreases the loss on a convex quadratic", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const ls = frames.map((f) => Number(f.meta["loss"]));
        for (let i = 1; i < ls.length; i += 1) {
            expect(ls[i] ?? Infinity).toBeLessThanOrEqual((ls[i - 1] ?? 0) + 1e-9);
        }
        expect(ls[ls.length - 1] ?? Infinity).toBeLessThan(ls[0] ?? 0);
    });

    it("keeps accumulators nondecreasing and nonnegative", () => {
        const frames = [...mod.run(mod.defaultInput)];
        let prev0 = 0;
        let prev1 = 0;
        for (const frame of frames) {
            const a0 = Number(frame.meta["a0"] ?? 0);
            const a1 = Number(frame.meta["a1"] ?? 0);
            expect(a0).toBeGreaterThanOrEqual(prev0);
            expect(a1).toBeGreaterThanOrEqual(prev1);
            prev0 = a0;
            prev1 = a1;
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
