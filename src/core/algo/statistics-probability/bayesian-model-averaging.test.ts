/**
 * bayesian-model-averaging.test.ts - Posterior weights against a direct
 * reference, invariance properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bayesian-model-averaging";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBe(count + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Reference weights computed without the log-sum-exp stabilization. */
function reference(bics: number[], estimates: number[]): { weights: number[]; estimate: number } {
    const raw = bics.map((bic) => Math.exp(-0.5 * bic));
    const total = raw.reduce((a, b) => a + b, 0);
    const weights = raw.map((v) => v / total);
    const estimate = weights.reduce((acc, w, i) => acc + w * estimates[i]!, 0);
    return { weights, estimate };
}

describe("BayesianModelAveraging", () => {
    it("matches directly computed posterior weights and averaged estimate", () => {
        const input = mod.defaultInput as {
            models: Array<{ bic: number; estimate: number }>;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.models.length);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(
            input.models.map((m) => m.bic),
            input.models.map((m) => m.estimate),
        );
        const weights = meta["weights"] as number[];
        for (let i = 0; i < weights.length; i += 1) {
            expect(weights[i]).toBeCloseTo(expected.weights[i]!, 10);
        }
        expect(meta["estimate"]).toBeCloseTo(expected.estimate, 10);
    });

    it("keeps weights a probability distribution and favors lower BIC", () => {
        for (const bics of [[10, 12, 15], [4, 4, 4], [1, 9, 20]] as number[][]) {
            const frames = [...mod.run({ models: bics.map((bic, i) => ({ bic, estimate: i })) })];
            const weights = frames[frames.length - 1]!.meta["weights"] as number[];
            const total = weights.reduce((a, b) => a + b, 0);
            expect(total).toBeCloseTo(1, 10);
            expect(weights.every((w) => w >= 0)).toBe(true);
            for (let i = 1; i < bics.length; i += 1) {
                if (bics[i]! > bics[i - 1]!) {
                    expect(weights[i]!).toBeLessThanOrEqual(weights[i - 1]! + 1e-12);
                }
            }
        }
    });

    it("is invariant to adding a constant to every BIC", () => {
        const a = [...mod.run({ models: [{ bic: 2, estimate: 1 }, { bic: 6, estimate: 5 }] })].pop()!.meta;
        const b = [...mod.run({ models: [{ bic: 102, estimate: 1 }, { bic: 106, estimate: 5 }] })].pop()!.meta;
        expect((a["weights"] as number[])[0]).toBeCloseTo((b["weights"] as number[])[0]!, 10);
        expect(a["estimate"]).toBeCloseTo(b["estimate"] as number, 10);
    });

    it("handles the empty input and terminates cleanly", () => {
        const empty = [...mod.run({ models: [] })];
        expect(empty).toHaveLength(1);
        expect(empty[0]!.entities).toHaveLength(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe((mod.defaultInput as { models: unknown[] }).models.length + 2);
        expect(generator.next().done).toBe(true);
    });
});
