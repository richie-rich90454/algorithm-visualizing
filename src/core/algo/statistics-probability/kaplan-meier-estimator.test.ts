/**
 * kaplan-meier-estimator.test.ts - Product-limit cross-check, properties, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./kaplan-meier-estimator";
import type { VisualFrame } from "@/types";

/** Independent Kaplan-Meier product-limit computation. */
function reference(times: number[], events: number[]): number[] {
    const recs = times.map((t, i) => ({ t, e: events[i] === 1 ? 1 : 0 })).sort((a, b) => a.t - b.t);
    const distinct = [...new Set(recs.map((r) => r.t))].sort((a, b) => a - b);
    const survival: number[] = [];
    let s = 1;
    for (const t of distinct) {
        const atRisk = recs.filter((r) => r.t >= t).length;
        const d = recs.filter((r) => r.t === t && r.e === 1).length;
        if (d > 0 && atRisk > 0) s *= 1 - d / atRisk;
        survival.push(s);
    }
    return survival;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * Number(frame.meta["cols"]));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(4);
    });
}

describe("Kaplan-Meier Estimator", () => {
    it("matches an independent product-limit computation", () => {
        const cases = [
            { times: [1, 2, 2, 3, 4, 5, 5, 8], events: [1, 1, 0, 1, 0, 1, 1, 0] },
            { times: [3, 1, 2, 4], events: [1, 1, 0, 1] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            const expected = reference(testCase.times, testCase.events);
            const actual = final?.meta["survival"] as number[];
            expect(actual.length).toBe(expected.length);
            expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 12));
        }
    });

    it("keeps survival in range, nonincreasing, and handles no events", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const actual = frames[frames.length - 1]?.meta["survival"] as number[];
        expect(actual[0]).toBeCloseTo(0.9, 12);
        for (let i = 0; i < actual.length; i += 1) {
            expect(actual[i]).toBeGreaterThanOrEqual(0);
            expect(actual[i]).toBeLessThanOrEqual(1);
            if (i > 0) expect(actual[i] as number).toBeLessThanOrEqual(actual[i - 1] as number);
        }

        const noEvents = [...mod.run({ times: [1, 2, 3], events: [0, 0, 0] })];
        const flat = noEvents[noEvents.length - 1]?.meta["survival"] as number[];
        expect(flat.every((v) => v === 1)).toBe(true);
        expect(noEvents[noEvents.length - 1]?.meta["medianSurvival"]).toBe("none");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
