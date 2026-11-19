/** contrastive-divergence.test.ts - Brute-force CD-k sampling and gradient, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./contrastive-divergence";
import type { VisualFrame } from "@/types";

interface Input {
    v: number[];
    W: number[];
    hBias: number[];
    vBias: number[];
    k: number;
    seed: number;
}

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
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function reference(input: Input) {
    const random = mulberry32(input.seed);
    const pHidden = (vis: number[]) =>
        input.hBias.map((bias, j) => sigmoid(bias + input.W[2 * j]! * vis[0]! + input.W[2 * j + 1]! * vis[1]!));
    const pVisible = (hid: number[]) =>
        input.vBias.map((bias, i) => sigmoid(bias + input.W[i]! * hid[0]! + input.W[2 + i]! * hid[1]!));
    const sample = (probs: number[]) => probs.map((p) => (random() < p ? 1 : 0));
    const dataProb = pHidden(input.v);
    const dataSample = sample(dataProb);
    let hidden = dataSample.slice();
    let visPrime = input.v.slice();
    let hidPrime = hidden.slice();
    for (let step = 0; step < input.k; step += 1) {
        visPrime = sample(pVisible(hidden));
        hidPrime = sample(pHidden(visPrime));
        hidden = hidPrime.slice();
    }
    const deltaW = [
        input.v[0]! * dataSample[0]! - visPrime[0]! * hidPrime[0]!,
        input.v[1]! * dataSample[0]! - visPrime[1]! * hidPrime[0]!,
        input.v[0]! * dataSample[1]! - visPrime[0]! * hidPrime[1]!,
        input.v[1]! * dataSample[1]! - visPrime[1]! * hidPrime[1]!,
    ];
    return { dataProb, dataSample, visPrime, hidPrime, deltaW };
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

describe("Contrastive divergence", () => {
    const cases: Input[] = [
        { v: [1, 0], W: [0.8, -0.5, 0.3, 0.6], hBias: [0, -0.2], vBias: [0.1, 0], k: 1, seed: 7 },
        { v: [0, 1], W: [-1, 0.5, 0.2, -0.3], hBias: [0.1, 0.2], vBias: [-0.1, 0.3], k: 2, seed: 42 },
        { v: [1, 1], W: [0.5, 0.5, 0.5, 0.5], hBias: [-0.5, -0.5], vBias: [0, 0], k: 3, seed: 123 },
        mod.defaultInput as Input,
    ];

    it("matches a brute-force seeded CD-k run", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            (final?.["dataProb"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.dataProb[i]!, 9));
            (final?.["dataSample"] as number[]).forEach((v, i) => expect(v).toBe(expected.dataSample[i]!));
            (final?.["visiblePrime"] as number[]).forEach((v, i) => expect(v).toBe(expected.visPrime[i]!));
            (final?.["hiddenPrime"] as number[]).forEach((v, i) => expect(v).toBe(expected.hidPrime[i]!));
            (final?.["deltaW"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.deltaW[i]!, 9));
        }
    });

    it("is deterministic for a seed and changes with a different seed", () => {
        const input = cases[0]!;
        const a = [...mod.run(input)].at(-1)?.meta?.["deltaW"] as number[];
        const b = [...mod.run(input)].at(-1)?.meta?.["deltaW"] as number[];
        expect(a).toEqual(b);
        const c = [...mod.run({ ...input, seed: 8 })].at(-1)?.meta?.["deltaW"] as number[];
        expect(a).not.toEqual(c);
    });

    it("gradient equals data outer product minus reconstruction outer product", () => {
        for (const input of cases) {
            const final = [...mod.run(input)].at(-1)?.meta;
            const d = final?.["dataSample"] as number[];
            const vp = final?.["visiblePrime"] as number[];
            const hp = final?.["hiddenPrime"] as number[];
            const g = final?.["deltaW"] as number[];
            expect(g[0]).toBeCloseTo(input.v[0]! * d[0]! - vp[0]! * hp[0]!, 9);
            expect(g[3]).toBeCloseTo(input.v[1]! * d[1]! - vp[1]! * hp[1]!, 9);
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
