/**
 * bert-pretraining.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bert-pretraining";
import type { VisualFrame } from "@/types";

interface BertInput {
    tokens: number[]; nextTokens: number[]; seed: number;
    maskProbability: number; vocabSize: number; isNext: boolean;
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

function reference(cfg: BertInput) {
    const inputIds = [1, ...cfg.tokens, 2];
    const random = mulberry32(cfg.seed);
    const masked = inputIds.slice();
    const targets: number[] = [];
    const positions: number[] = [];
    for (let index = 1; index <= cfg.tokens.length; index += 1) {
        if (random() >= cfg.maskProbability) continue;
        targets.push(cfg.tokens[index - 1] ?? 0);
        positions.push(index);
        const choice = random();
        if (choice < 0.8) masked[index] = 0;
        else if (choice < 0.9) masked[index] = 3 + Math.floor(random() * Math.max(1, cfg.vocabSize - 3));
    }
    const predictions = positions.map((index) => {
        const ti = index - 1;
        const left = cfg.tokens[ti - 1] ?? cfg.tokens[ti + 1] ?? 3;
        const right = cfg.tokens[ti + 1] ?? cfg.tokens[ti - 1] ?? 3;
        return Math.max(3, Math.min(cfg.vocabSize - 1, Math.round((left + right) / 2)));
    });
    const correct = predictions.filter((p, i) => p === targets[i]).length;
    const accuracy = positions.length ? correct / positions.length : 0;
    const combined = [1, ...cfg.tokens, 2, ...cfg.nextTokens, 2];
    const segmentIds = [...new Array(cfg.tokens.length + 2).fill(0), ...new Array(cfg.nextTokens.length + 1).fill(1)];
    return { inputIds, masked, targets, positions, predictions, accuracy, combined, segmentIds };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
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

describe("BERT pretraining objective", () => {
    it("matches an independent masking and prediction reference", () => {
        const cfg: BertInput = {
            tokens: [5, 7, 3, 8, 4, 9], nextTokens: [6, 10, 11],
            seed: 42, maskProbability: 0.3, vocabSize: 12, isNext: true,
        };
        const frames = [...mod.run(cfg)];
        checkFrames(frames);
        const expected = reference(cfg);
        expect(frames[0]?.meta["values"]).toEqual(expected.inputIds);
        expect(frames[1]?.meta["targets"]).toEqual(expected.targets);
        expect(frames[1]?.meta["values"]).toEqual(expected.masked);
        expect(frames[2]?.meta["predictions"]).toEqual(expected.predictions);
        expect(Number(frames[2]?.meta["accuracy"])).toBeCloseTo(expected.accuracy, 6);
        expect(frames[3]?.meta["combined"]).toEqual(expected.combined);
        expect(frames[3]?.meta["segmentIds"]).toEqual(expected.segmentIds);
    });

    it("is deterministic for a fixed seed and changes with another seed", () => {
        const base = { tokens: [4, 6, 9, 3, 8, 5, 7], nextTokens: [10, 11], maskProbability: 0.35, vocabSize: 12, isNext: false };
        const a = [...mod.run({ ...base, seed: 1 })][1]?.meta["maskPositions"];
        const b = [...mod.run({ ...base, seed: 1 })][1]?.meta["maskPositions"];
        const c = [...mod.run({ ...base, seed: 999 })][1]?.meta["maskPositions"];
        expect(a).toEqual(b);
        expect(a).not.toEqual(c);
    });

    it("keeps segment ids and next-sentence label in range", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const segmentIds = frames[3]?.meta["segmentIds"] as number[];
        expect(segmentIds.every((id) => id === 0 || id === 1)).toBe(true);
        expect(frames[3]?.meta["isNext"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
