/**
 * stein-estimation.test.ts - Independent shrink/risk reference, dominance and
 * positive-part properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./stein-estimation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function reference(values: number[], target: number[], positivePart: boolean) {
    const p = values.length;
    const norm = values.reduce((acc, v, i) => acc + (v - target[i]!) ** 2, 0);
    let factor = norm > 0 ? 1 - (p - 2) / norm : 1;
    if (positivePart) {
        factor = Math.max(0, factor);
    }
    return {
        shrink: factor,
        shrunk: values.map((v, i) => target[i]! + factor * (v - target[i]!)),
        riskStein: p - (p - 2) ** 2 / norm,
    };
}

describe("SteinEstimation", () => {
    it("matches an independent James-Stein reference", () => {
        const input = mod.defaultInput as { values: number[]; target: number[]; positivePart: boolean };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.values.length);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input.values, input.target, input.positivePart);
        expect(meta["shrink"]).toBeCloseTo(expected.shrink, 10);
        expect(meta["riskStein"]).toBeCloseTo(expected.riskStein, 10);
        expect(meta["shrunk"]).toEqual(expected.shrunk);
    });

    it("dominates the raw estimator for any vector of dimension at least three", () => {
        for (const values of [[1, 2, 3], [10, 20, 30, 40], [-5, 0, 7, 2, 9], [0.1, 0.2, 0.3]]) {
            const meta = [...mod.run({ values })].pop()!.meta;
            expect(meta["riskStein"] as number).toBeLessThan(meta["riskMean"] as number);
            const factor = meta["shrink"] as number;
            expect(factor).toBeGreaterThanOrEqual(0);
            expect(factor).toBeLessThanOrEqual(1);
        }
    });

    it("positive part clamps to the target when the vector is short", () => {
        const meta = [...mod.run({ values: [0.1, 0.1, 0.1], target: [0, 0, 0], positivePart: true })].pop()!.meta;
        expect(meta["shrink"]).toBe(0);
        expect(meta["shrunk"]).toEqual([0, 0, 0]);
    });

    it("treats fewer than three coordinates as a degeneracy", () => {
        const meta = [...mod.run({ values: [1, 2] })].pop()!.meta;
        expect(meta["degeneracy"]).toBe(true);
        expect(meta["shrink"]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe((mod.defaultInput as { values: number[] }).values.length + 2);
        expect(generator.next().done).toBe(true);
    });
});
