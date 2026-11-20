/** wgan-gp.test.ts - Independent gradient-penalty reference, analytic gradients, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./wgan-gp";
import type { VisualFrame } from "@/types";

interface Input {
    real: number[];
    fake: number[];
    eps: number[];
    w: number;
    b: number;
    c: number;
    lambda: number;
    lr: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.meta).toBeDefined();
    });
}

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

function reference(input: Input) {
    const n = Math.min(input.real.length, input.fake.length);
    const f = (x: number): number => input.w * x + input.b + input.c * x * x;
    const realScores = input.real.slice(0, n).map(f);
    const fakeScores = input.fake.slice(0, n).map(f);
    const xHat: number[] = [];
    const gradHat: number[] = [];
    const penalties: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const point = input.eps[i]! * input.real[i]! + (1 - input.eps[i]!) * input.fake[i]!;
        const grad = input.w + 2 * input.c * point;
        xHat.push(point);
        gradHat.push(grad);
        penalties.push((Math.abs(grad) - 1) ** 2);
    }
    const gradientPenalty = input.lambda * mean(penalties);
    const wasserstein = mean(fakeScores) - mean(realScores);
    const criticLoss = mean(realScores) - mean(fakeScores) + gradientPenalty;
    const updatedFake = input.fake.slice(0, n).map((x) => x + input.lr * (input.w + 2 * input.c * x));
    return { xHat, gradHat, penalties, gradientPenalty, wasserstein, criticLoss, updatedFake };
}

describe("Wasserstein GAN with Gradient Penalty", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent gradient-penalty and Wasserstein computation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input);
        (meta["xHat"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.xHat[i]!, 8));
        (meta["gradHat"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.gradHat[i]!, 8));
        (meta["penalties"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.penalties[i]!, 8));
        expect(Number(meta["gradientPenalty"])).toBeCloseTo(expected.gradientPenalty, 8);
        expect(Number(meta["wasserstein"])).toBeCloseTo(expected.wasserstein, 8);
        expect(Number(meta["criticLoss"])).toBeCloseTo(expected.criticLoss, 8);
        (meta["updatedFake"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.updatedFake[i]!, 8));
    });

    it("penalty is zero when the critic gradient is exactly one everywhere", () => {
        const unit = { ...input, w: 1, c: 0, lambda: 100 };
        const frames = [...mod.run(unit)];
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["gradNorm"] as number[]).toEqual(input.real.slice(0, 4).map(() => 1));
        expect(Number(meta["gradientPenalty"])).toBeCloseTo(0, 10);
        (meta["penalties"] as number[]).forEach((v) => expect(v).toBeCloseTo(0, 10));
    });

    it("gradient penalty grows when the gradient deviates from one", () => {
        const off = { ...input, w: 3, c: 0, lambda: 10 };
        const meta = [...mod.run(off)].at(-1)!.meta;
        expect(Number(meta["gradientPenalty"])).toBeCloseTo(10 * (3 - 1) ** 2, 8);
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
