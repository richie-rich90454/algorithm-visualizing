/** weighted-random-early-detection.test.ts - Independent reference, monotonicity, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { wredStep, type WredParams } from "./weighted-random-early-detection";
import type { VisualFrame } from "@/types";

function reference(queues: number[], weights: number[], p: WredParams) {
    let avg = 0;
    return queues.map((q, i) => {
        const w = weights[i] ?? 0.5;
        const scale = 1.1 - w;
        const minEff = p.minTh * scale;
        const maxEff = Math.max(minEff + 1, p.maxTh * scale);
        avg = (1 - p.wq) * avg + p.wq * q;
        let prob = 0;
        if (avg >= maxEff) prob = p.maxP;
        else if (avg >= minEff) prob = p.maxP * (avg - minEff) / (maxEff - minEff);
        return { avg, minEff, maxEff, prob };
    });
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Weighted Random Early Detection", () => {
    it("matches an independently written EWMA and threshold reference", () => {
        for (let trial = 0; trial < 25; trial += 1) {
            const queues = Array.from({ length: 6 + (trial % 9) }, (_, i) => (trial * i + i * i) % 25);
            const weights = queues.map((_, i) => ((i + trial) % 10 + 1) / 10);
            const params: WredParams = {
                wq: 0.01 + (trial % 5) * 0.02,
                minTh: 3,
                maxTh: 12,
                maxP: 0.2,
                weight: 0.5,
            };
            const expected = reference(queues, weights, params);
            let avg = 0;
            queues.forEach((q, i) => {
                const got = wredStep(i, q, avg, { ...params, weight: weights[i] ?? 0.5 });
                avg = got.average;
                expect(got.average).toBeCloseTo(expected[i]!.avg, 10);
                expect(got.minEff).toBeCloseTo(expected[i]!.minEff, 10);
                expect(got.maxEff).toBeCloseTo(expected[i]!.maxEff, 10);
                expect(got.probability).toBeCloseTo(expected[i]!.prob, 10);
            });
        }
    });

    it("has a monotone drop probability and a class ordering", () => {
        const params: WredParams = { wq: 1, minTh: 5, maxTh: 15, maxP: 0.5, weight: 0.5 };
        let previous = -1;
        for (let q = 0; q <= 40; q += 1) {
            const s = wredStep(0, q, q, params);
            expect(s.probability).toBeGreaterThanOrEqual(previous);
            previous = s.probability;
        }
        const gentle = wredStep(0, 9, 9, { ...params, weight: 0.2 });
        const harsh = wredStep(0, 9, 9, { ...params, weight: 1 });
        expect(harsh.probability).toBeGreaterThan(gentle.probability);
        expect(wredStep(0, 1, 1, params).probability).toBe(0);
    });

    it("emits well-formed frames and terminates", () => {
        const input = mod.defaultInput as { queues: number[]; weights: number[] };
        const generator = mod.run(input);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["done"]).toBe(true);
        expect(frames[frames.length - 1]!.meta["drops"]).toBeGreaterThanOrEqual(0);
        expect(generator.next().done).toBe(true);
    });
});
