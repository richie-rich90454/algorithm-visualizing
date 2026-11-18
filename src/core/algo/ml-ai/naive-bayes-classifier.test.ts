/**
 * naive-bayes-classifier.test.ts - Independent posterior check, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./naive-bayes-classifier";
import type { VisualFrame } from "@/types";

type Sample = [number, number, number];

function reference(samples: Sample[], query: [number, number], eps: number) {
    const labels = [...new Set(samples.map((s) => s[2]))].sort((a, b) => a - b);
    const n = Math.max(1, samples.length);
    let best = labels[0]!;
    let bestScore = -Infinity;
    const scores: number[] = [];
    for (const label of labels) {
        const members = samples.filter((s) => s[2] === label);
        const meanX = members.reduce((a, s) => a + s[0], 0) / Math.max(1, members.length);
        const meanY = members.reduce((a, s) => a + s[1], 0) / Math.max(1, members.length);
        const varX = Math.max(
            eps,
            members.reduce((a, s) => a + (s[0] - meanX) ** 2, 0) / Math.max(1, members.length),
        );
        const varY = Math.max(
            eps,
            members.reduce((a, s) => a + (s[1] - meanY) ** 2, 0) / Math.max(1, members.length),
        );
        const prior = Math.log(Math.max(1e-15, members.length / n));
        const term = (v: number, m: number, vr: number) =>
            -0.5 * Math.log(2 * Math.PI * vr) - ((v - m) ** 2) / (2 * vr);
        const score = prior + term(query[0], meanX, varX) + term(query[1], meanY, varY);
        scores.push(score);
        if (score > bestScore) {
            bestScore = score;
            best = label;
        }
    }
    return { labels, scores, prediction: best };
}

function checkFrames(frames: VisualFrame[], sampleCount: number, classCount: number): void {
    expect(frames.length).toBe(classCount + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(sampleCount + 1 + classCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Array.isArray(frame.meta["scores"])).toBe(true);
    });
}

describe("NaiveBayesClassifier", () => {
    it("matches an independent posterior computation on the default input", () => {
        const input = mod.defaultInput as { samples: Sample[]; query: [number, number]; epsilon: number };
        const frames = [...mod.run(input)];
        const expected = reference(input.samples, input.query, input.epsilon);
        checkFrames(frames, input.samples.length, expected.labels.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["prediction"]).toBe(expected.prediction);
        const scores = finalMeta?.["scores"] as number[];
        for (let i = 0; i < scores.length; i += 1) {
            expect(scores[i]).toBeCloseTo(expected.scores[i]!, 5);
        }
        expect(finalMeta?.["prediction"]).toBe(2);
    });

    it("classifies queries across all three well-separated clusters", () => {
        const samples: Sample[] = [
            [0, 0, 0],
            [0.3, 0.2, 0],
            [5, 5, 1],
            [5.2, 4.8, 1],
            [0, 8, 2],
            [0.2, 8.1, 2],
        ];
        const queries: Array<[number, number, number]> = [
            [0.1, 0.1, 0],
            [5.1, 5, 1],
            [0.1, 8, 2],
        ];
        for (const [qx, qy, expectedLabel] of queries) {
            const frames = [...mod.run({ samples, query: [qx, qy] })];
            checkFrames(frames, samples.length, 3);
            expect(frames[frames.length - 1]?.meta["prediction"]).toBe(expectedLabel);
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
