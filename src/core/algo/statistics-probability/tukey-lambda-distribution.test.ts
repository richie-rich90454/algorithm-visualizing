/**
 * tukey-lambda-distribution.test.ts - Quantile identities, special cases, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./tukey-lambda-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(Number(frame.meta["points"]) + 1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Interpolate the emitted quantile curve at an arbitrary probability. */
function quantileAt(frames: VisualFrame[], p: number): number {
    const final = frames[frames.length - 1];
    const ps = final?.meta["ps"] as number[];
    const qs = final?.meta["quantiles"] as number[];
    for (let i = 1; i < ps.length; i += 1) {
        if ((ps[i] as number) >= p) {
            const lo = ps[i - 1] as number;
            const hi = ps[i] as number;
            const f = hi > lo ? (p - lo) / (hi - lo) : 0;
            return (qs[i - 1] as number) + f * ((qs[i] as number) - (qs[i - 1] as number));
        }
    }
    return qs[qs.length - 1] as number;
}

describe("Tukey Lambda Distribution", () => {
    it("is symmetric with a zero median across several shapes", () => {
        for (const lambda of [-1, 0, 0.5, 1, 2]) {
            const frames = [...mod.run({ lambda, points: 200 })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            expect(final?.meta["median"] as number).toBeCloseTo(0, 12);
            const qs = final?.meta["quantiles"] as number[];
            for (let i = 0; i < qs.length; i += 1) {
                expect((qs[i] as number) + (qs[qs.length - 1 - i] as number)).toBeCloseTo(0, 9);
            }
            for (let i = 1; i < qs.length; i += 1) {
                expect(qs[i] as number).toBeGreaterThan(qs[i - 1] as number);
            }
        }
    });

    it("matches the uniform special case at lambda one", () => {
        const frames = [...mod.run({ lambda: 1, points: 200 })];
        expect(quantileAt(frames, 0.25)).toBeCloseTo(-0.5, 6);
        expect(quantileAt(frames, 0.75)).toBeCloseTo(0.5, 6);
        const final = frames[frames.length - 1];
        const ps = final?.meta["ps"] as number[];
        const density = final?.meta["density"] as number[];
        const midpoint = Math.floor(ps.length / 2);
        expect(density[midpoint]).toBeCloseTo(0.5, 9);
        expect(final?.meta["iqr"] as number).toBeCloseTo(1, 6);
    });

    it("matches the logistic limit at lambda zero", () => {
        const frames = [...mod.run({ lambda: 0, points: 400 })];
        expect(quantileAt(frames, 0.75)).toBeCloseTo(Math.log(3), 4);
        expect(quantileAt(frames, 0.25)).toBeCloseTo(-Math.log(3), 4);
        const final = frames[frames.length - 1];
        const ps = final?.meta["ps"] as number[];
        const density = final?.meta["density"] as number[];
        const midpoint = Math.floor(ps.length / 2);
        expect(density[midpoint]).toBeCloseTo(0.25, 9);
    });

    it("keeps density positive and terminates cleanly", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1];
        const density = final?.meta["density"] as number[];
        expect(density.every((value) => value > 0 && Number.isFinite(value))).toBe(true);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
