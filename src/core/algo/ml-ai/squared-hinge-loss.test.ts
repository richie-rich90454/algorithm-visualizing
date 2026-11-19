/** squared-hinge-loss.test.ts - Definition, zero region, smoothness, and frame checks. */

import { describe, expect, it } from "vitest";
import mod, { squaredHingeFor } from "./squared-hinge-loss";
import type { VisualFrame } from "@/types";

interface Input {
    scores: number[];
    labels: number[];
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBe(rows + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Squared Hinge Loss", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force evaluation of max(0, 1 - y*s)^2", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.scores.length);
        const got = frames[frames.length - 1]?.meta["losses"] as number[];
        input.scores.forEach((score, i) => {
            const label = input.labels[i] ?? 1;
            const hinge = Math.max(0, 1 - label * score);
            expect(got[i]).toBeCloseTo(hinge * hinge, 12);
        });
    });

    it("is zero with a sufficient margin and never negative", () => {
        expect(squaredHingeFor(1, 1.4).loss).toBe(0);
        for (const score of [-3, -0.2, 0.5, 1.3, 4]) {
            const result = squaredHingeFor(1, score);
            expect(result.loss).toBeGreaterThanOrEqual(0);
            expect(result.loss).toBeCloseTo(result.hinge * result.hinge, 12);
        }
    });

    it("is symmetric and drops faster than the linear hinge near the margin", () => {
        for (const score of [-2, -0.4, 0.3, 1.7]) {
            expect(squaredHingeFor(1, score).loss).toBeCloseTo(squaredHingeFor(-1, -score).loss, 12);
        }
        const hinge = 0.4;
        expect(hinge * hinge).toBeLessThan(hinge);
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
