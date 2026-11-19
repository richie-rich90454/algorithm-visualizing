/** hinge-loss.test.ts - Definition, symmetry, zero region, and frame checks. */

import { describe, expect, it } from "vitest";
import mod, { hingeFor } from "./hinge-loss";
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
        expect(frame.meta["rows"]).toBe(rows);
    });
}

describe("Hinge Loss", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force evaluation of max(0, 1 - y*s)", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.scores.length);
        const got = frames[frames.length - 1]?.meta["losses"] as number[];
        input.scores.forEach((score, i) => {
            const label = input.labels[i] ?? 1;
            expect(got[i]).toBeCloseTo(Math.max(0, 1 - label * score), 12);
        });
        const mean = got.reduce((a, b) => a + b, 0) / got.length;
        expect(frames[frames.length - 1]?.meta["mean"]).toBeCloseTo(mean, 12);
    });

    it("is zero for a sufficient margin and symmetric under flipping label and score", () => {
        expect(hingeFor(1, 1.5).loss).toBe(0);
        expect(hingeFor(-1, -1.5).loss).toBe(0);
        expect(hingeFor(1, 0.2).loss).toBeCloseTo(0.8, 12);
        for (const label of [-1, 1]) {
            for (const score of [-2, -0.3, 0, 0.4, 2]) {
                expect(hingeFor(label, score).loss).toBeCloseTo(hingeFor(-label, -score).loss, 12);
            }
        }
    });

    it("counts violated margins correctly", () => {
        const frames = [...mod.run(input)];
        const expected = input.scores.filter((score, i) => score * (input.labels[i] ?? 1) < 1).length;
        expect(frames[frames.length - 1]?.meta["violations"]).toBe(expected);
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
