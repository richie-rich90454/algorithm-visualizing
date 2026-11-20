/**
 * electra.test.ts - Independent reference correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./electra";
import type { VisualFrame } from "@/types";

interface ElectraInput {
    tokens: number[];
    seed: number;
    replaceProbability: number;
    vocabSize: number;
}

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
}

function reference(cfg: ElectraInput) {
    const random = mulberry32(cfg.seed);
    const corrupted = cfg.tokens.slice();
    const labels = new Array<number>(cfg.tokens.length).fill(0);
    const replaced: number[] = [];
    for (let i = 0; i < cfg.tokens.length; i += 1) {
        if (random() >= cfg.replaceProbability || cfg.vocabSize <= 4) continue;
        let alternative = 3 + Math.floor(random() * (cfg.vocabSize - 3));
        if (alternative === cfg.tokens[i]) alternative = 3 + ((alternative - 3 + 1) % (cfg.vocabSize - 3));
        corrupted[i] = alternative;
        labels[i] = 1;
        replaced.push(i);
    }
    const scores: number[] = [];
    const predictions: number[] = [];
    for (let i = 0; i < corrupted.length; i += 1) {
        const self = corrupted[i] ?? 0;
        const left = i > 0 ? (corrupted[i - 1] ?? 0) : 0;
        const right = i < corrupted.length - 1 ? (corrupted[i + 1] ?? 0) : 0;
        const z = 1 * self + -0.5 * left + -0.5 * right + 0;
        scores.push(z);
        predictions.push(z >= 0 ? 1 : 0);
    }
    let lossSum = 0;
    for (let i = 0; i < labels.length; i += 1) {
        const p = Math.min(1 - 1e-12, Math.max(1e-12, sigmoid(scores[i] ?? 0)));
        const y = labels[i] ?? 0;
        lossSum += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    }
    const loss = labels.length ? lossSum / labels.length : 0;
    const detected = predictions.filter((p, i) => p === labels[i]).length;
    const accuracy = labels.length ? detected / labels.length : 0;
    return { corrupted, labels, replaced, scores, predictions, loss, accuracy };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe(mod.visualType);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("ELECTRA replaced token detection", () => {
    it("matches an independent generator, discriminator, and loss reference", () => {
        const cfg: ElectraInput = {
            tokens: [5, 7, 3, 8, 4, 9, 6, 2, 11],
            seed: 42,
            replaceProbability: 0.35,
            vocabSize: 16,
        };
        const frames = [...mod.run(cfg)];
        checkFrames(frames);
        const expected = reference(cfg);
        expect(frames[0]?.meta["tokens"]).toEqual(cfg.tokens);
        expect(frames[1]?.meta["corrupted"]).toEqual(expected.corrupted);
        expect(frames[1]?.meta["replacedPositions"]).toEqual(expected.replaced);
        expect(frames[2]?.meta["labels"]).toEqual(expected.labels);
        for (let i = 0; i < expected.scores.length; i += 1) {
            expect(Number((frames[3]?.meta["scores"] as number[])[i])).toBeCloseTo(expected.scores[i] ?? 0, 9);
        }
        expect(frames[3]?.meta["predictions"]).toEqual(expected.predictions);
        expect(Number(frames[4]?.meta["loss"])).toBeCloseTo(expected.loss, 8);
        expect(Number(frames[4]?.meta["accuracy"])).toBeCloseTo(expected.accuracy, 8);
    });

    it("satisfies label, replacement, prediction, and range properties", () => {
        const cfg: ElectraInput = {
            tokens: [4, 6, 9, 3, 8, 5, 7, 2, 10, 1],
            seed: 7,
            replaceProbability: 0.4,
            vocabSize: 20,
        };
        const frames = [...mod.run(cfg)];
        const corrupted = frames[1]?.meta["corrupted"] as number[];
        const labels = frames[2]?.meta["labels"] as number[];
        const predictions = frames[3]?.meta["predictions"] as number[];
        const accuracy = Number(frames[4]?.meta["accuracy"]);
        const loss = Number(frames[4]?.meta["loss"]);
        expect(labels.every((value) => value === 0 || value === 1)).toBe(true);
        expect(predictions.every((value) => value === 0 || value === 1)).toBe(true);
        for (let i = 0; i < cfg.tokens.length; i += 1) {
            expect(labels[i] === 1).toBe(corrupted[i] !== cfg.tokens[i]);
            if (labels[i] === 1) {
                expect(corrupted[i]).toBeGreaterThanOrEqual(3);
                expect(corrupted[i]).toBeLessThan(cfg.vocabSize);
                expect(corrupted[i]).not.toBe(cfg.tokens[i]);
            }
        }
        expect(accuracy).toBeGreaterThanOrEqual(0);
        expect(accuracy).toBeLessThanOrEqual(1);
        expect(loss).toBeGreaterThanOrEqual(0);
    });

    it("is deterministic for a fixed seed and varies with another seed", () => {
        const base = { tokens: [4, 6, 9, 3, 8, 5, 7], replaceProbability: 0.4, vocabSize: 12 };
        const a = [...mod.run({ ...base, seed: 11 })][1]?.meta["corrupted"];
        const b = [...mod.run({ ...base, seed: 11 })][1]?.meta["corrupted"];
        const c = [...mod.run({ ...base, seed: 909 })][1]?.meta["corrupted"];
        expect(a).toEqual(b);
        expect(a).not.toEqual(c);
    });

    it("handles a small vocabulary without replacement", () => {
        const frames = [...mod.run({ tokens: [3, 4, 3], seed: 1, replaceProbability: 1, vocabSize: 4 })];
        expect(frames[1]?.meta["corrupted"]).toEqual([3, 4, 3]);
        expect(frames[2]?.meta["labels"]).toEqual([0, 0, 0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
