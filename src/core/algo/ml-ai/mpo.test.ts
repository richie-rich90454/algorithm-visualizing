/** mpo.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, { mpoFit } from "./mpo";
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

describe("Maximum a Posteriori Policy Optimization", () => {
    it("matches independent weights with the behavior correction and normal equations", () => {
        const input = mod.defaultInput as {
            states: number[][]; actions: number[]; qValues: number[]; behaviorProbs: number[]; eta: number; lambda: number;
        };
        const { states, actions, qValues, behaviorProbs, eta, lambda } = input;
        const result = mpoFit(states, actions, qValues, behaviorProbs, eta, lambda);
        const frames = [...mod.run(input)];
        checkFrames(frames, states.length);

        const raw = qValues.map((q, i) => Math.exp(q / eta) / behaviorProbs[i]);
        const total = raw.reduce((a, b) => a + b, 0);
        const expectedWeights = raw.map((w) => (w / total) * states.length);
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
        expect(result.effectiveK).toBeGreaterThan(0);
        expect(result.effectiveK).toBeLessThanOrEqual(states.length + 1e-9);
    });

    it("favors rare high-value actions via the behavior correction", () => {
        const common = mpoFit([[1], [1]], [0, 1], [0, 0], [0.9, 0.1], 1, 0);
        expect(common.weights[1]).toBeGreaterThan(common.weights[0]);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
