/**
 * brier-score.test.ts - Independent formula, known value, perfect and
 * chance baselines, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./brier-score";
import type { VisualFrame } from "@/types";

function reference(predictions: number[], outcomes: number[]): number {
    const n = Math.min(predictions.length, outcomes.length);
    if (n === 0) return 0;
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
        const p = Math.min(1, Math.max(0, predictions[i] ?? 0));
        const y = (outcomes[i] ?? 0) >= 0.5 ? 1 : 0;
        sum += (p - y) ** 2;
    }
    return sum / n;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
    expect(frames[frames.length - 1].entities.every((e) => e.state === "sorted")).toBe(true);
}

describe("BrierScore", () => {
    it("matches an independent formula computation", () => {
        const p = [0.1, 0.35, 0.6, 0.85, 0.99, 0.2];
        const y = [0, 0, 1, 1, 1, 1];
        const frames = [...mod.run({ predictions: p, outcomes: y })];
        checkFrames(frames, p.length);
        expect(Number(frames[frames.length - 1].meta["score"])).toBeCloseTo(reference(p, y), 10);
    });

    it("reproduces known values and baselines", () => {
        const score = (p: number[], y: number[]) => Number([...mod.run({ predictions: p, outcomes: y })].at(-1)?.meta["score"]);
        expect(score([0.9, 0.7, 0.2, 0.6], [1, 1, 0, 0])).toBeCloseTo(0.125, 10);
        expect(score([1, 0, 1], [1, 0, 1])).toBeCloseTo(0, 10);
        expect(score([0.5, 0.5], [1, 0])).toBeCloseTo(0.25, 10);
    });

    it("clamps probabilities to the unit interval", () => {
        const p = [-0.4, 1.8];
        expect(Number([...mod.run({ predictions: p, outcomes: [0, 1] })].at(-1)?.meta["score"])).toBeCloseTo(0, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
