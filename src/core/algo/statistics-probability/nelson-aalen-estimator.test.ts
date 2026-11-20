/**
 * nelson-aalen-estimator.test.ts - Independent risk-set cross-check, properties, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./nelson-aalen-estimator";
import type { VisualFrame } from "@/types";

function reference(times: number[], events: number[]): { distinct: number[]; hazard: number[]; atRisk: number[] } {
    const records = times.map((time, index) => ({ time, event: events[index] === 1 ? 1 : 0 })).sort((a, b) => a.time - b.time);
    const distinct = [...new Set(records.map((record) => record.time))].sort((a, b) => a - b);
    const hazard: number[] = [];
    const atRisk: number[] = [];
    let total = 0;
    for (const time of distinct) {
        const n = records.filter((record) => record.time >= time).length;
        const d = records.filter((record) => record.time === time && record.event === 1).length;
        if (n > 0 && d > 0) total += d / n;
        atRisk.push(n);
        hazard.push(total);
    }
    return { distinct, hazard, atRisk };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe((frame.meta["distinctTimes"] as number[]).length);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Nelson-Aalen Estimator", () => {
    it("matches an independent risk-set computation", () => {
        const cases = [
            { times: [1, 2, 2, 3, 4, 5, 5, 8], events: [1, 1, 0, 1, 0, 1, 1, 0] },
            { times: [3, 1, 2, 4], events: [1, 1, 0, 1] },
            { times: [1, 1, 1, 2], events: [1, 0, 1, 0] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            const expected = reference(testCase.times, testCase.events);
            expect(final?.meta["distinctTimes"]).toEqual(expected.distinct);
            expect(final?.meta["atRisk"]).toEqual(expected.atRisk);
            const hazard = final?.meta["cumulativeHazard"] as number[];
            expect(hazard.length).toBe(expected.hazard.length);
            expected.hazard.forEach((value, index) => expect(hazard[index] as number).toBeCloseTo(value, 12));
        }
    });

    it("keeps hazard monotone and survival consistent with the exponential", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1];
        const hazard = final?.meta["cumulativeHazard"] as number[];
        const survival = final?.meta["survival"] as number[];
        for (let i = 0; i < hazard.length; i += 1) {
            expect(hazard[i] as number).toBeGreaterThanOrEqual(0);
            expect(survival[i] as number).toBeCloseTo(Math.exp(-(hazard[i] as number)), 12);
            if (i > 0) expect(hazard[i] as number).toBeGreaterThanOrEqual(hazard[i - 1] as number);
        }
        expect(final?.meta["finalSurvival"] as number).toBeCloseTo(Math.exp(-(final?.meta["finalHazard"] as number)), 12);
    });

    it("returns zero hazard when no events occur", () => {
        const frames = [...mod.run({ times: [1, 2, 3], events: [0, 0, 0] })];
        const final = frames[frames.length - 1];
        expect((final?.meta["cumulativeHazard"] as number[]).every((value) => value === 0)).toBe(true);
        expect((final?.meta["survival"] as number[]).every((value) => value === 1)).toBe(true);
        expect(final?.meta["finalHazard"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
