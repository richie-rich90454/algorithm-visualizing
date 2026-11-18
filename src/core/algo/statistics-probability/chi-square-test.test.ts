/**
 * chi-square-test.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./chi-square-test";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], categories: number): void {
    expect(frames.length).toBe(categories + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(3 * categories);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Chi-Square Goodness-of-Fit Test", () => {
    it("matches a direct chi-square computation", () => {
        const observed = [25, 20, 15, 10, 30];
        const expected = [20, 20, 20, 20, 20];
        const frames = [...mod.run({ observed, expected })];
        checkFrames(frames, observed.length);
        const reference = observed.reduce(
            (acc, o, i) => acc + (o - (expected[i] as number)) ** 2 / (expected[i] as number),
            0,
        );
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["chi2"] as number).toBeCloseTo(reference, 10);
        expect(meta?.["df"]).toBe(4);
        expect(meta?.["significant"]).toBe(true);
    });

    it("gives known chi-square tail probabilities", () => {
        // A chi-square of 3.841459 with 1 df has right-tail probability 0.05.
        const d1 = Math.sqrt(3.841459 * 25 / 2);
        const one = [...mod.run({ observed: [25 + d1, 25 - d1], expected: [25, 25] })];
        const pOne = one[one.length - 1]?.meta["pValue"] as number;
        expect(pOne).toBeCloseTo(0.05, 4);

        // Four equal expected counts of 25: choose observed to produce
        // chi-square near the 0.05 critical value of 7.814728 (df = 3).
        const target = 7.814728;
        const delta = Math.sqrt(target * 25 / 2);
        const observed = [25 + delta, 25 - delta, 25, 25];
        const three = [...mod.run({ observed, expected: [25, 25, 25, 25] })];
        const meta = three[three.length - 1]?.meta;
        expect(meta?.["chi2"] as number).toBeCloseTo(target, 4);
        expect(meta?.["pValue"] as number).toBeCloseTo(0.05, 4);
    });

    it("reports a large p-value when observed matches expected", () => {
        const frames = [...mod.run({ observed: [20, 20, 20, 20], expected: [20, 20, 20, 20] })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["chi2"] as number).toBeCloseTo(0, 10);
        expect(meta?.["pValue"] as number).toBeCloseTo(1, 10);
        expect(meta?.["significant"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
