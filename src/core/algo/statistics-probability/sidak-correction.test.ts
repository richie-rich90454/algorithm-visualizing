/**
 * sidak-correction.test.ts - Independent adjustment check, FWER identity,
 * comparison with Bonferroni, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sidak-correction";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], m: number): void {
    expect(frames.length).toBe(m + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(m);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["m"]).toBe(m);
    });
}

describe("SidakCorrection", () => {
    it("matches an independent threshold and adjustment computation", () => {
        const input = mod.defaultInput as { pValues: number[]; alpha: number };
        const frames = [...mod.run(input)];
        const m = input.pValues.length;
        checkFrames(frames, m);
        const threshold = 1 - Math.pow(1 - input.alpha, 1 / m);
        const adjusted = input.pValues.map((p) => 1 - Math.pow(1 - p, m));
        const rejected: number[] = input.pValues.map((p) => (p <= threshold ? 1 : 0));
        const meta = frames[frames.length - 1]!.meta;
        expect(Number(meta["threshold"])).toBeCloseTo(threshold, 12);
        expect(meta["adjustedP"] as number[]).toEqual(adjusted);
        expect(meta["rejected"] as number[]).toEqual(rejected);
        expect(meta["rejectCount"]).toBe(rejected.reduce((a, b) => a + b, 0));
    });

    it("keeps family-wise error at alpha and is never more conservative than Bonferroni", () => {
        for (const alpha of [0.05, 0.01, 0.1]) {
            const pValues = [0.0001, 0.003, 0.02, 0.05, 0.2, 0.9];
            const frames = [...mod.run({ pValues, alpha })];
            checkFrames(frames, pValues.length);
            const meta = frames[frames.length - 1]!.meta;
            const fwer = 1 - Math.pow(1 - Number(meta["threshold"]), pValues.length);
            expect(fwer).toBeCloseTo(alpha, 10);
            expect(Number(meta["fwer"])).toBeCloseTo(alpha, 10);
            expect(Number(meta["threshold"])).toBeGreaterThanOrEqual(alpha / pValues.length - 1e-12);
            const adjusted = meta["adjustedP"] as number[];
            for (let i = 0; i < pValues.length; i += 1) {
                expect(adjusted[i]!).toBeGreaterThanOrEqual(pValues[i]!);
                expect(adjusted[i]!).toBeLessThanOrEqual(pValues.length * pValues[i]! + 1e-12);
                if (i > 0) expect(adjusted[i]!).toBeGreaterThanOrEqual(adjusted[i - 1]!);
            }
        }
    });

    it("rejects exactly when the adjusted p value is at most alpha", () => {
        const pValues = [0.001, 0.02, 0.2];
        const alpha = 0.05;
        const meta = [...mod.run({ pValues, alpha })].at(-1)!.meta;
        const adjusted = meta["adjustedP"] as number[];
        const rejected = meta["rejected"] as number[];
        for (let i = 0; i < pValues.length; i += 1) {
            expect(rejected[i]).toBe(adjusted[i]! <= alpha ? 1 : 0);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
