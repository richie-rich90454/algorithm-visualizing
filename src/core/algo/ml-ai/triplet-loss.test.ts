/** triplet-loss.test.ts - Squared-distance definition, margin behavior, and frame checks. */

import { describe, expect, it } from "vitest";
import mod, { tripletFor } from "./triplet-loss";
import type { VisualFrame } from "@/types";

interface Input {
    anchors: number[][];
    positives: number[][];
    negatives: number[][];
    margin: number;
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

function squaredDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) {
        sum += ((a[i] ?? 0) - (b[i] ?? 0)) ** 2;
    }
    return sum;
}

describe("Triplet Loss", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force squared-distance evaluation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.anchors.length);
        const got = frames[frames.length - 1]?.meta["losses"] as number[];
        input.anchors.forEach((anchor, i) => {
            const positive = input.positives[i] ?? [];
            const negative = input.negatives[i] ?? [];
            const dp = squaredDistance(anchor, positive);
            const dn = squaredDistance(anchor, negative);
            expect(got[i]).toBeCloseTo(Math.max(0, dp - dn + input.margin), 12);
        });
    });

    it("is zero when the constraint is satisfied and grows with the margin", () => {
        const anchor = [0, 0];
        const positive = [0.1, 0];
        const negative = [2, 0];
        expect(tripletFor(anchor, positive, negative, 0.5).loss).toBe(0);
        const tight = tripletFor(anchor, positive, [0.2, 0], 0.5).loss;
        const wider = tripletFor(anchor, positive, [0.2, 0], 1.5).loss;
        expect(wider).toBeGreaterThan(tight);
        expect(tripletFor(anchor, positive, [0.2, 0], 0).loss).toBeGreaterThanOrEqual(0);
    });

    it("reports the gap and distances consistently", () => {
        const result = tripletFor([0, 0], [1, 0], [0, 3], 0.5);
        expect(result.positiveDistance).toBeCloseTo(1, 12);
        expect(result.negativeDistance).toBeCloseTo(9, 12);
        expect(result.gap).toBeCloseTo(-8, 12);
        expect(result.loss).toBe(0);
        expect(result.active).toBe(false);
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
