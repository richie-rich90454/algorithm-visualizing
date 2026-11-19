/** ddim.test.ts - Brute-force deterministic trajectory, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./ddim";
import type { VisualFrame } from "@/types";

interface Input { signal: number[]; alphas: number[]; seed: number; noise?: number[] }
function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}
function gaussian(random: () => number): number {
    const u1 = Math.max(1e-12, random());
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function reference(input: Input) {
    const alphas = input.alphas.map((a) => Math.min(1, Math.max(1e-6, a)));
    const random = mulberry32(input.seed);
    const noise = input.noise && input.noise.length === input.signal.length ? [...input.noise] : input.signal.map(() => gaussian(random));
    const sqrt = Math.sqrt;
    const x = input.signal.map((v, i) => sqrt(alphas[0] ?? 1) * v + sqrt(1 - (alphas[0] ?? 1)) * (noise[i] ?? 0));
    let prediction = [...input.signal];
    for (let k = 0; k < alphas.length - 1; k += 1) {
        const aT = alphas[k] ?? 1;
        const aPrev = alphas[k + 1] ?? 1;
        prediction = x.map((v, i) => (v - sqrt(1 - aT) * (noise[i] ?? 0)) / sqrt(aT));
        for (let i = 0; i < x.length; i += 1) x[i] = sqrt(aPrev) * (prediction[i] ?? 0) + sqrt(1 - aPrev) * (noise[i] ?? 0);
    }
    return { sample: x, prediction };
}
function checkFrames(frames: VisualFrame[], dim: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(dim);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Number(frame.meta["eta"])).toBe(0);
    });
}

describe("DDIM", () => {
    it("matches a brute-force deterministic trajectory", () => {
        const cases: Input[] = [
            { signal: [-2, -1, 0, 1, 2], alphas: [0.04, 0.16, 0.64, 1], seed: 7 },
            { signal: [1.5, -3, 0, 4], alphas: [0.01, 0.25, 1], seed: 123, noise: [0.1, -0.2, 0.3, -0.4] },
            { signal: [0, 0, 0], alphas: [0.5, 1], seed: 5 },
            mod.defaultInput as Input,
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.signal.length);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            (final?.["sample"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.sample[i]!, 5));
        }
    });

    it("recovers the clean signal exactly with oracle noise", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        (final?.["sample"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(input.signal[i]!, 6));
        expect(final?.["converged"]).toBe(true);
        expect(Number(final?.["error"])).toBeLessThan(1e-8);
    });

    it("predicted clean signal errors stay near zero at every timestep", () => {
        const frames = [...mod.run(mod.defaultInput)];
        frames.slice(1, -1).forEach((frame) => expect(Number(frame.meta["error"])).toBeLessThan(1e-8));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
