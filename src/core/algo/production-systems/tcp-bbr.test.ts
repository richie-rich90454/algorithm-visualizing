/**
 * tcp-bbr.test.ts - Estimator convergence, invariants, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./tcp-bbr";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rounds: number): void {
    expect(frames.length).toBe(rounds);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(rounds);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("TCP BBR", () => {
    it("converges to the true bottleneck bandwidth and base delay", () => {
        const input = { capacity: 10, baseRtt: 4, rounds: 24 };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.rounds);
        const final = frames[frames.length - 1];
        expect(Number(final?.meta["finalBtlBw"])).toBeCloseTo(input.capacity, 9);
        expect(Number(final?.meta["finalRtprop"])).toBeCloseTo(input.baseRtt, 9);
        const modes = final?.meta["modes"] as string[];
        expect(modes).toContain("STARTUP");
        expect(modes).toContain("DRAIN");
        expect(modes).toContain("PROBE_BW");
    });

    it("respects link capacity and keeps control variables finite", () => {
        for (const input of [
            { capacity: 10, baseRtt: 4, rounds: 24 },
            { capacity: 25, baseRtt: 8, rounds: 30 },
        ]) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.rounds);
            const final = frames[frames.length - 1];
            const delivered = final?.meta["delivered"] as number[];
            const pacingRates = final?.meta["pacingRates"] as number[];
            const cwnds = final?.meta["cwnds"] as number[];
            expect(delivered.length).toBe(input.rounds);
            delivered.forEach((value) => {
                expect(value).toBeLessThanOrEqual(input.capacity + 1e-9);
                expect(value).toBeGreaterThanOrEqual(0);
            });
            pacingRates.forEach((v) => expect(Number.isFinite(v) && v > 0).toBe(true));
            cwnds.forEach((v) => expect(Number.isFinite(v) && v >= 4).toBe(true));
            expect(Number(final?.meta["finalBtlBw"])).toBeCloseTo(input.capacity, 9);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
