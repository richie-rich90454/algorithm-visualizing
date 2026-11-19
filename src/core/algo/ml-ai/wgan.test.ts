/** wgan.test.ts - Brute-force critic loss, gradient, clipping property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./wgan";
import type { VisualFrame } from "@/types";

interface Input {
    real: number[];
    fake: number[];
    w: number;
    b: number;
    clip: number;
    lr: number;
}

function reference(input: Input) {
    const crit = (x: number) => input.w * x + input.b;
    const realScores = input.real.map(crit);
    const fakeScores = input.fake.map(crit);
    const meanReal = realScores.reduce((a, v) => a + v, 0) / input.real.length;
    const meanFake = fakeScores.reduce((a, v) => a + v, 0) / input.fake.length;
    const wasserstein = meanReal - meanFake;
    const dW =
        -input.real.reduce((a, v) => a + v, 0) / input.real.length +
        input.fake.reduce((a, v) => a + v, 0) / input.fake.length;
    const wUpdated = Math.max(-input.clip, Math.min(input.clip, input.w - input.lr * dW));
    return { realScores, fakeScores, wasserstein, criticLoss: -wasserstein, dW, wUpdated, genLoss: -meanFake };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Wasserstein GAN critic", () => {
    const cases: Input[] = [
        { real: [2, 3, 2.5], fake: [0, 1, -1], w: 0.3, b: 0, clip: 0.01, lr: 0.05 },
        { real: [-1, 1], fake: [-2, 2], w: -0.2, b: 0.5, clip: 0.02, lr: 0.1 },
        { real: [10, 20], fake: [1, 2, 3], w: 0, b: 0, clip: 0.001, lr: 0.01 },
        mod.defaultInput as Input,
    ];

    it("matches brute-force critic scores, loss, and gradient", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["wasserstein"])).toBeCloseTo(expected.wasserstein, 9);
            expect(Number(final?.["criticLoss"])).toBeCloseTo(expected.criticLoss, 9);
            expect(Number(final?.["dW"])).toBeCloseTo(expected.dW, 9);
            expect(Number(final?.["wUpdated"])).toBeCloseTo(expected.wUpdated, 9);
            expect(Number(final?.["genLoss"])).toBeCloseTo(expected.genLoss, 9);
            const scores = frames[2]?.meta?.["realScores"] as number[];
            scores.forEach((v, i) => expect(v).toBeCloseTo(expected.realScores[i]!, 9));
        }
    });

    it("always clips the weight into the allowed interval", () => {
        for (const input of cases) {
            const final = [...mod.run(input)].at(-1)?.meta;
            expect(Boolean(final?.["clipped"])).toBe(true);
            expect(Math.abs(Number(final?.["wUpdated"]))).toBeLessThanOrEqual(input.clip + 1e-12);
        }
    });

    it("increases the critic weight when real values exceed fake values", () => {
        const input: Input = { real: [5, 6], fake: [0, 0], w: 0, b: 0, clip: 1, lr: 0.1 };
        const final = [...mod.run(input)].at(-1)?.meta;
        expect(Number(final?.["dW"])).toBeLessThan(0);
        expect(Number(final?.["wUpdated"])).toBeGreaterThan(input.w);
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
