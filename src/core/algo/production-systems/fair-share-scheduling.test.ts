/**
 * fair-share-scheduling.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./fair-share-scheduling";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Fair-share scheduling", () => {
    it("allocates CPU close to configured shares", () => {
        const cases: Array<{ shares: Record<string, number>; ticks: number }> = [
            { shares: { A: 2, B: 1, C: 1 }, ticks: 1000 },
            { shares: { X: 3, Y: 1 }, ticks: 800 },
            { shares: { P: 1, Q: 1, R: 1, S: 1 }, ticks: 1200 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const usage = meta?.["usage"] as Record<string, number>;
            const totalShare = Object.values(input.shares).reduce((a, b) => a + b, 0);
            for (const group of Object.keys(input.shares)) {
                const expectedFraction = (input.shares[group] ?? 0) / totalShare;
                const actualFraction = (usage[group] ?? 0) / input.ticks;
                expect(Math.abs(actualFraction - expectedFraction)).toBeLessThan(0.02);
            }
            const sum = Object.values(usage).reduce((a, b) => a + b, 0);
            expect(sum).toBe(input.ticks);
        }
    });

    it("always picks the minimum used-to-share ratio during the run", () => {
        const frames = [...mod.run({ shares: { A: 2, B: 1 }, ticks: 20 })];
        for (let i = 1; i < frames.length - 1; i += 1) {
            const previous = frames[i - 1]?.meta["usage"] as Record<string, number>;
            const current = frames[i]?.meta["usage"] as Record<string, number>;
            const chosen = Object.keys(current).find((g) => (current[g] ?? 0) > (previous[g] ?? 0)) ?? "";
            expect(chosen).not.toBe("");
            for (const group of Object.keys(previous)) {
                const share = group === "A" ? 2 : 1;
                const chosenPrevRatio = (previous[chosen] ?? 0) / (chosen === "A" ? 2 : 1);
                expect(chosenPrevRatio).toBeLessThanOrEqual((previous[group] ?? 0) / share + 1e-12);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
