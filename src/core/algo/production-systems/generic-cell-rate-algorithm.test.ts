/**
 * generic-cell-rate-algorithm.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { gcraSchedule } from "./generic-cell-rate-algorithm";
import type { VisualFrame } from "@/types";

type Input = { arrivals: number[]; rate: number; tolerance: number };

function reference(input: Input) {
    const interval = 1 / input.rate;
    let tat = 0;
    return input.arrivals.map((arrival) => {
        const conforming = arrival >= tat - input.tolerance;
        if (conforming) tat = Math.max(tat, arrival) + interval;
        return { conforming, tat };
    });
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Generic Cell Rate Algorithm", () => {
    it("matches an independent virtual-scheduling reference", () => {
        const cases: Input[] = [
            { arrivals: [0, 1, 2, 3, 4], rate: 1, tolerance: 0 },
            { arrivals: [0, 0.2, 0.4, 2, 2.1, 3], rate: 2, tolerance: 0.5 },
            { arrivals: [5, 5, 6, 6.5, 7, 9], rate: 1.5, tolerance: 0.25 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.arrivals.length, 4);
            const expected = reference(input);
            const final = frames[frames.length - 1]!.meta;
            expect(final["decisions"]).toEqual(expected.map((e) => (e.conforming ? 1 : 0)));
            expect(final["tatAfter"]).toEqual(expected.map((e) => e.tat));
            expect(gcraSchedule(input.arrivals, 1 / input.rate, input.tolerance).map((s) => s.conforming))
                .toEqual(expected.map((e) => e.conforming));
        }
    });

    it("zero tolerance rejects two cells closer than one interval", () => {
        const input: Input = { arrivals: [0, 0.5, 1, 1.5], rate: 1, tolerance: 0 };
        const steps = gcraSchedule(input.arrivals, 1, 0);
        expect(steps.map((s) => s.conforming)).toEqual([true, false, true, false]);
        // A discarded cell freezes the theoretical arrival time.
        expect(steps[1]!.tatAfter).toBe(steps[1]!.tatBefore);
    });

    it("tolerance admits an early burst", () => {
        const steps = gcraSchedule([0, 0.5, 1.5], 1, 0.5);
        expect(steps.every((s) => s.conforming)).toBe(true);
        expect(gcraSchedule([0, 0.5, 1.5], 1, 0).map((s) => s.conforming)).toEqual([true, false, true]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
