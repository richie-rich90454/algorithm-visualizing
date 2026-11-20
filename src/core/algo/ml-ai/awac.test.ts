/** awac.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, { awacFit } from "./awac";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Advantage-Weighted Actor Critic", () => {
    it("matches independent weights and satisfies the normal equations", () => {
        const input = mod.defaultInput as {
            states: number[][]; actions: number[]; advantages: number[]; beta: number; lambda: number;
        };
        const { states, actions, advantages, beta, lambda } = input;
        const result = awacFit(states, actions, advantages, beta, lambda);
        const frames = [...mod.run(input)];
        checkFrames(frames, states.length);

        const raw = advantages.map((a) => Math.exp(a / beta));
        const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
        const expectedWeights = raw.map((w) => w / mean);
        result.weights.forEach((w, i) => expect(w).toBeCloseTo(expectedWeights[i], 10));
        expect(expectedWeights.reduce((a, b) => a + b, 0) / expectedWeights.length).toBeCloseTo(1, 10);

        const d = states[0].length;
        const gram = Array.from({ length: d }, () => Array(d).fill(0));
        const rhs = Array(d).fill(0);
        states.forEach((s, i) => {
            const w = expectedWeights[i];
            for (let a = 0; a < d; a += 1) {
                rhs[a] += w * s[a] * actions[i];
                for (let b = 0; b < d; b += 1) gram[a][b] += w * s[a] * s[b];
            }
        });
        for (let a = 0; a < d; a += 1) gram[a][a] += lambda;
        gram.forEach((row, i) => {
            const residual = row.reduce((s, v, j) => s + v * result.theta[j], 0) - rhs[i];
            expect(Math.abs(residual)).toBeLessThan(1e-8);
        });
        states.forEach((s, i) => {
            const predicted = s.reduce((sum, v, k) => sum + v * result.theta[k], 0);
            expect(result.predictions[i]).toBeCloseTo(predicted, 10);
        });
    });

    it("ranks higher advantages with higher weights", () => {
        const result = awacFit([[1], [1], [1]], [0, 0, 0], [-1, 0, 1], 1, 0);
        expect(result.weights[0]).toBeLessThan(result.weights[1]);
        expect(result.weights[1]).toBeLessThan(result.weights[2]);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
