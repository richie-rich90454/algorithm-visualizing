/** least-squares-gan.test.ts - Independent LSGAN objective, descent, fixed point, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./least-squares-gan";
import type { VisualFrame } from "@/types";

interface Input {
    real: number[];
    fake: number[];
    slope: number;
    lr: number;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBe(n);
    });
}

function dLoss(real: number[], fake: number[], a: number): number {
    const r = real.reduce((s, x) => s + Math.pow(a * x - 1, 2), 0) / (2 * real.length);
    const f = fake.reduce((s, x) => s + Math.pow(a * x, 2), 0) / (2 * fake.length);
    return r + f;
}

function gLoss(fake: number[], a: number): number {
    return fake.reduce((s, x) => s + Math.pow(a * x - 1, 2), 0) / (2 * fake.length);
}

function grad(real: number[], fake: number[], a: number): number {
    const r = real.reduce((s, x) => s + (a * x - 1) * x, 0) / real.length;
    const f = fake.reduce((s, x) => s + a * x * x, 0) / fake.length;
    return r + f;
}

describe("Least-Squares GAN", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent LSGAN objective and gradient", () => {
        const frames = [...mod.run(input)];
        expect(frames.length).toBe(4);
        checkFrames(frames, input.real.length + input.fake.length);
        const meta = frames.at(-1)!.meta;
        expect(Number(meta["dLoss"])).toBeCloseTo(dLoss(input.real, input.fake, input.slope), 10);
        expect(Number(meta["gLoss"])).toBeCloseTo(gLoss(input.fake, input.slope), 10);
        expect(Number(meta["grad"])).toBeCloseTo(grad(input.real, input.fake, input.slope), 10);
        const nextSlope = input.slope - input.lr * grad(input.real, input.fake, input.slope);
        expect(Number(meta["nextSlope"])).toBeCloseTo(nextSlope, 10);
        expect(Number(meta["dLossAfter"])).toBeCloseTo(dLoss(input.real, input.fake, nextSlope), 10);
        expect(Number(meta["gLossAfter"])).toBeCloseTo(gLoss(input.fake, nextSlope), 10);
    });

    it("lowers the discriminator loss with a small gradient step", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        expect(Number(meta["dLossAfter"])).toBeLessThan(Number(meta["dLoss"]));
    });

    it("converges to the analytic fixed point and separates real from fake", () => {
        let slope = input.slope;
        for (let i = 0; i < 400; i += 1) {
            slope -= 0.05 * grad(input.real, input.fake, slope);
        }
        const realMeanSquare = input.real.reduce((s, x) => s + x * x, 0) / input.real.length;
        const fakeMeanSquare = input.fake.reduce((s, x) => s + x * x, 0) / input.fake.length;
        const realMean = input.real.reduce((s, x) => s + x, 0) / input.real.length;
        const fakeMean = input.fake.reduce((s, x) => s + x, 0) / input.fake.length;
        expect(slope).toBeCloseTo(realMean / (realMeanSquare + fakeMeanSquare), 4);
        expect(slope * realMean).toBeGreaterThan(slope * fakeMean);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
