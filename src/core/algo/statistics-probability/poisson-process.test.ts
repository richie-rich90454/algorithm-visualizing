/**
 * poisson-process.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./poisson-process";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], observations: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(observations);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Poisson process", () => {
    it("counts arrivals at or before each observation time", () => {
        const input = { lambda: 2, horizon: 20, seed: 42, observationTimes: [0.5, 1, 3, 7, 15, 20] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.observationTimes.length);
        const final = frames[frames.length - 1]!.meta;
        const arrivals = final["arrivalTimes"] as number[];
        const counts = final["counts"] as number[];
        const times = final["observationTimes"] as number[];
        expect(arrivals.length).toBeGreaterThan(0);
        for (let i = 1; i < arrivals.length; i += 1) {
            expect(arrivals[i] as number).toBeGreaterThan(arrivals[i - 1] as number);
            expect(arrivals[i] as number).toBeLessThanOrEqual(input.horizon);
        }
        for (let i = 0; i < times.length; i += 1) {
            const brute = arrivals.reduce((sum, t) => sum + (t <= (times[i] as number) ? 1 : 0), 0);
            expect(counts[i]).toBe(brute);
            if (i > 0) {
                expect(counts[i] as number).toBeGreaterThanOrEqual(counts[i - 1] as number);
            }
        }
    });

    it("is deterministic for a fixed seed and changes with a different seed", () => {
        const base = { lambda: 1, horizon: 10, seed: 7, observationTimes: [1, 2, 3, 5, 7, 10] };
        const a = [...mod.run(base)];
        const b = [...mod.run(base)];
        const c = [...mod.run({ ...base, seed: 8 })];
        const arrivalsA = JSON.stringify(a[a.length - 1]!.meta["arrivalTimes"]);
        const arrivalsB = JSON.stringify(b[b.length - 1]!.meta["arrivalTimes"]);
        const arrivalsC = JSON.stringify(c[c.length - 1]!.meta["arrivalTimes"]);
        expect(arrivalsA).toBe(arrivalsB);
        expect(arrivalsA).not.toBe(arrivalsC);
    });

    it("produces positive gaps whose mean approaches one over the rate", () => {
        const frames = [...mod.run({ lambda: 3, horizon: 4000, seed: 99, observationTimes: [4000] })];
        const arrivals = frames[frames.length - 1]!.meta["arrivalTimes"] as number[];
        expect(arrivals.length).toBeGreaterThan(1000);
        const gaps: number[] = [];
        let previous = 0;
        for (const t of arrivals) {
            gaps.push(t - previous);
            previous = t;
        }
        expect(gaps.every((g) => g > 0)).toBe(true);
        const mean = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
        expect(mean).toBeCloseTo(1 / 3, 1);
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
