/** generative-adversarial-network.test.ts - Brute-force GAN losses and gradients, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./generative-adversarial-network";
import type { VisualFrame } from "@/types";

interface Input {
    real: number[];
    noise: number[];
    w: number;
    b: number;
    gBias: number;
    lr: number;
}

function reference(input: Input) {
    const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
    const safe = (x: number) => Math.max(1e-12, Math.min(1 - 1e-12, x));
    const fake = input.noise.map((v) => v + input.gBias);
    const dReal = input.real.map((v) => sigmoid(input.w * v + input.b));
    const dFake = fake.map((v) => sigmoid(input.w * v + input.b));
    const n = input.real.length + fake.length;
    const dLoss = -(
        dReal.reduce((s, d) => s + Math.log(safe(d)), 0) +
        dFake.reduce((s, d) => s + Math.log(1 - safe(d)), 0)
    ) / n;
    const gLoss = -dFake.reduce((s, d) => s + Math.log(safe(d)), 0) / fake.length;
    const dDw = -(
        input.real.reduce((s, x, i) => s + (1 - dReal[i]!) * x, 0) -
        fake.reduce((s, x, i) => s + dFake[i]! * x, 0)
    ) / n;
    const dDb = -(dReal.reduce((s, d) => s + 1 - d, 0) - dFake.reduce((s, d) => s + d, 0)) / n;
    const dGbias = -dFake.reduce((s, d) => s + (1 - d), 0) / fake.length;
    return {
        fake,
        dReal,
        dFake,
        dLoss,
        gLoss,
        dDw,
        dDb,
        dGbias,
        wNew: input.w - input.lr * dDw,
        bNew: input.b - input.lr * dDb,
        gBiasNew: input.gBias - input.lr * dGbias,
    };
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

describe("Generative adversarial network", () => {
    const cases: Input[] = [
        { real: [1.5, 2, 2.5], noise: [0, 0.5, 1], w: 0.5, b: 0, gBias: 0, lr: 0.1 },
        { real: [-1, 1], noise: [-0.5, 0.5], w: -0.3, b: 0.2, gBias: 0.5, lr: 0.05 },
        { real: [3, 4], noise: [0, 1, 2], w: 0.2, b: -0.5, gBias: -0.2, lr: 0.2 },
        mod.defaultInput as Input,
    ];

    it("matches a brute-force minimax step", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["dLoss"])).toBeCloseTo(expected.dLoss, 9);
            expect(Number(final?.["gLoss"])).toBeCloseTo(expected.gLoss, 9);
            expect(Number(final?.["dDw"])).toBeCloseTo(expected.dDw, 9);
            expect(Number(final?.["dDb"])).toBeCloseTo(expected.dDb, 9);
            expect(Number(final?.["dGbias"])).toBeCloseTo(expected.dGbias, 9);
            expect(Number(final?.["wNew"])).toBeCloseTo(expected.wNew, 9);
            expect(Number(final?.["bNew"])).toBeCloseTo(expected.bNew, 9);
            expect(Number(final?.["gBiasNew"])).toBeCloseTo(expected.gBiasNew, 9);
        }
    });

    it("pushes fake samples toward the real distribution", () => {
        const input: Input = { real: [5, 6], noise: [0, 1], w: 0.5, b: 0, gBias: 0, lr: 0.1 };
        const final = [...mod.run(input)].at(-1)?.meta;
        expect(Number(final?.["dGbias"])).toBeLessThan(0);
        expect(Number(final?.["gBiasNew"])).toBeGreaterThan(input.gBias);
    });

    it("keeps discriminator scores strictly inside zero and one", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const scores = frames[2]?.meta;
            for (const d of [...(scores?.["dReal"] as number[]), ...(scores?.["dFake"] as number[])]) {
                expect(d).toBeGreaterThan(0);
                expect(d).toBeLessThan(1);
            }
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
