/**
 * yarn-context-extension.test.ts - Independent frequency recomputation, ramp
 * endpoints, scale-one identity, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./yarn-context-extension";
import type { VisualFrame } from "@/types";

function reference(dim: number, base: number, scale: number, origMaxPos: number, alpha: number, beta: number) {
    const half = dim / 2;
    const basePrime = base * scale ** (dim / (dim - 2));
    const out = { basePrime, invFreqOrig: [] as number[], invFreqScaled: [] as number[], rotations: [] as number[], gamma: [] as number[], invFreqYaRN: [] as number[] };
    for (let i = 0; i < half; i += 1) {
        const orig = base ** (-2 * i / dim);
        const scaled = basePrime ** (-2 * i / dim);
        const lambda = (2 * Math.PI) / orig;
        const r = origMaxPos / lambda;
        const g = Math.min(1, Math.max(0, (r - alpha) / (beta - alpha)));
        out.invFreqOrig.push(orig);
        out.invFreqScaled.push(scaled);
        out.rotations.push(r);
        out.gamma.push(g);
        out.invFreqYaRN.push(((1 - g) * orig + g * scaled) / scale);
    }
    return out;
}

function checkFrames(frames: VisualFrame[], half: number): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(half);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("YaRNContextExtension", () => {
    it("matches an independent frequency computation for several settings", () => {
        const settings = [
            { dim: 8, base: 10000, scale: 4, origMaxPos: 2048, alpha: 1, beta: 4 },
            { dim: 16, base: 1000, scale: 8, origMaxPos: 4096, alpha: 2, beta: 8 },
            { dim: 6, base: 500, scale: 2, origMaxPos: 512, alpha: 0, beta: 3 },
        ];
        for (const setting of settings) {
            const frames = [...mod.run(setting)];
            checkFrames(frames, setting.dim / 2);
            const expected = reference(setting.dim, setting.base, setting.scale, setting.origMaxPos, setting.alpha, setting.beta);
            const final = frames[frames.length - 1];
            expect(Number(final?.meta["basePrime"])).toBeCloseTo(expected.basePrime, 9);
            (final?.meta["invFreqOrig"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.invFreqOrig[i] ?? 0, 12));
            (final?.meta["invFreqScaled"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.invFreqScaled[i] ?? 0, 12));
            (final?.meta["rotations"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.rotations[i] ?? 0, 9));
            (final?.meta["gamma"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.gamma[i] ?? 0, 12));
            (final?.meta["invFreqYaRN"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.invFreqYaRN[i] ?? 0, 12));
        }
    });

    it("keeps the ramp in range and frequencies strictly decreasing", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1];
        const gamma = final?.meta["gamma"] as number[];
        gamma.forEach((g) => {
            expect(g).toBeGreaterThanOrEqual(0);
            expect(g).toBeLessThanOrEqual(1);
        });
        const freqs = final?.meta["invFreqYaRN"] as number[];
        for (let i = 1; i < freqs.length; i += 1) expect(freqs[i] ?? 0).toBeLessThan(freqs[i - 1] ?? 0);
    });

    it("reproduces the original frequencies when the scale is one", () => {
        const frames = [...mod.run({ dim: 8, base: 10000, scale: 1, origMaxPos: 2048, alpha: 1, beta: 4 })];
        const final = frames[frames.length - 1];
        const orig = final?.meta["invFreqOrig"] as number[];
        const yarn = final?.meta["invFreqYaRN"] as number[];
        yarn.forEach((v, i) => expect(v).toBeCloseTo(orig[i] ?? 0, 12));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
