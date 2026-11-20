/**
 * phi-accrual-failure-detector.test.ts - Accrual math, window stats, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { computePhi, erf, simulatePhi } from "./phi-accrual-failure-detector";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], ticks: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(ticks);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["cols"]).toBe(ticks);
    });
}

describe("Phi-accrual failure detector", () => {
    it("erf approximation is accurate", () => {
        expect(erf(0)).toBeCloseTo(0, 6);
        expect(erf(1)).toBeCloseTo(0.84270079, 5);
        expect(erf(-1)).toBeCloseTo(-0.84270079, 5);
        expect(erf(2)).toBeCloseTo(0.99532227, 5);
    });

    it("phi is zero at a heartbeat and grows with the pause", () => {
        const window = [4, 5, 6, 5, 5];
        expect(computePhi(0, window)).toBeLessThan(0.01);
        let previous = -Infinity;
        for (const elapsed of [1, 3, 5, 8, 12, 20]) {
            const phi = computePhi(elapsed, window);
            expect(phi).toBeGreaterThan(previous);
            previous = phi;
        }
        expect(computePhi(10, window)).toBeGreaterThan(computePhi(5, window));
    });

    it("phi from an empty window is zero", () => {
        expect(computePhi(100, [])).toBe(0);
    });

    it("a crashed process eventually crosses the threshold and stays trusted before it", () => {
        const ticks = 30;
        const threshold = 5;
        const samples = simulatePhi(ticks, 5, 1, threshold, 10, 10, 42);
        for (const sample of samples) {
            if (sample.tick < 10) {
                expect(sample.suspected).toBe(false);
            }
        }
        const firstSuspectIndex = samples.findIndex((sample) => sample.suspected);
        expect(firstSuspectIndex).toBeGreaterThan(9);
        for (const sample of samples.slice(firstSuspectIndex)) {
            expect(sample.suspected).toBe(true);
        }
        const lastHeartbeat = samples.filter((sample) => sample.heartbeat).pop()?.tick as number;
        expect(samples[samples.length - 1]?.elapsed).toBe(ticks - lastHeartbeat);
    });

    it("a higher threshold never suspects earlier", () => {
        const low = simulatePhi(30, 5, 1, 3, 10, 10, 7);
        const high = simulatePhi(30, 5, 1, 9, 10, 10, 7);
        const lowTick = low.find((sample) => sample.suspected)?.tick ?? Infinity;
        const highTick = high.find((sample) => sample.suspected)?.tick ?? Infinity;
        expect(highTick).toBeGreaterThanOrEqual(lowTick);
    });

    it("reports a real suspicion in its final frame", () => {
        const input = { ticks: 24, interval: 5, jitter: 1, threshold: 4, windowSize: 10, crashAt: 10, seed: 3 };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.ticks);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["verdict"]).toBe("suspected");
        expect(typeof final?.["firstSuspectTick"]).toBe("number");
        expect(Number(final?.["detectionLatency"])).toBeGreaterThan(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
