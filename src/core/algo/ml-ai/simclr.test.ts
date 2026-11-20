/**
 * simclr.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./simclr";
import type { VisualFrame } from "@/types";

type Input = { positiveSimilarity: number; negativeSimilarities: number[]; temperature: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function bruteForceNtxent(positive: number, negatives: number[], tau: number): { probability: number; loss: number } {
    const logits = [positive, ...negatives].map((v) => v / tau);
    const max = Math.max(...logits);
    const exps = logits.map((v) => Math.exp(v - max));
    const probability = (exps[0] ?? 0) / exps.reduce((a, v) => a + v, 0);
    return { probability, loss: -Math.log(probability) };
}

describe("SimCLR NT-Xent", () => {
    it("matches a brute-force temperature-scaled softmax loss", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = bruteForceNtxent(input.positiveSimilarity, input.negativeSimilarities, input.temperature);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["probability"])).toBeCloseTo(expected.probability, 6);
        expect(Number(final?.["loss"])).toBeCloseTo(expected.loss, 6);
        expect(Number(final?.["loss"])).toBeGreaterThan(0);
    });

    it("a lower temperature sharpens the positive probability when it leads", () => {
        const args = { positiveSimilarity: 0.9, negativeSimilarities: [0.2, 0.1, -0.3, 0.4] };
        const warm = [...mod.run({ ...args, temperature: 1 })];
        const cool = [...mod.run({ ...args, temperature: 0.2 })];
        const pw = Number(warm[warm.length - 1]?.meta["probability"]);
        const pc = Number(cool[cool.length - 1]?.meta["probability"]);
        expect(pc).toBeGreaterThan(pw);
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
