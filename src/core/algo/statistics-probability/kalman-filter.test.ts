/**
 * kalman-filter.test.ts - Independent recursion, uncertainty and gain
 * properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./kalman-filter";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function reference(
    measurements: number[],
    x0: number,
    P0: number,
    Q: number,
    R: number,
): number[] {
    let x = x0;
    let P = P0;
    const out: number[] = [];
    for (const z of measurements) {
        const predicted = P + Q;
        const K = predicted / (predicted + R);
        x = x + K * (z - x);
        P = (1 - K) * predicted;
        out.push(x);
    }
    return out;
}

describe("KalmanFilter", () => {
    it("matches an independent recursion on the estimates", () => {
        const cases: Array<{ measurements: number[]; initialEstimate: number; initialP: number; Q: number; R: number }> = [
            { measurements: [10.2, 9.8, 10.5, 9.9], initialEstimate: 10, initialP: 1, Q: 0.01, R: 0.5 },
            { measurements: [1, 5, 2, 8, 3], initialEstimate: 0, initialP: 4, Q: 0.1, R: 2 },
            { measurements: [-3, -2.5, -4, -1], initialEstimate: 0, initialP: 10, Q: 0, R: 1 },
            { measurements: [100, 100, 100], initialEstimate: 0, initialP: 1, Q: 0.5, R: 0.5 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.measurements.length);
            const estimates = frames[frames.length - 1]?.meta["estimates"] as number[];
            const expected = reference(
                testCase.measurements,
                testCase.initialEstimate,
                testCase.initialP,
                testCase.Q,
                testCase.R,
            );
            for (let i = 0; i < expected.length; i += 1) {
                expect(estimates[i]).toBeCloseTo(expected[i]!, 10);
            }
        }
    });

    it("keeps gains in range and shrinks uncertainty every step", () => {
        const measurements = Array.from({ length: 40 }, (_, i) => 5 + Math.sin(i) * 2);
        const frames = [...mod.run({ measurements, Q: 0.05, R: 1 })];
        checkFrames(frames, measurements.length);
        const final = frames[frames.length - 1]?.meta;
        const gains = final?.["gains"] as number[];
        const errors = final?.["errors"] as number[];
        expect(gains.every((g) => g > 0 && g < 1)).toBe(true);
        for (let i = 1; i < errors.length; i += 1) {
            expect(errors[i]!).toBeLessThan(errors[i - 1]!);
        }
    });

    it("trusts a near-perfect measurement almost immediately", () => {
        const frames = [...mod.run({ measurements: [7, 7, 7], initialEstimate: 0, initialP: 1, Q: 0, R: 1e-9 })];
        checkFrames(frames, 3);
        const estimates = frames[frames.length - 1]?.meta["estimates"] as number[];
        expect(estimates[0]).toBeCloseTo(7, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});
