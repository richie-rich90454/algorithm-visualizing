/**
 * vector-autoregression.test.ts - Linear-algebra and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import mod, { fitVAR, solveLinear, varStep } from "./vector-autoregression";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], k: number): void {
    expect(frames.length).toBeGreaterThan(k + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(k * k);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Vector autoregression", () => {
    it("solves linear systems correctly", () => {
        const x = solveLinear(
            [
                [2, 1],
                [1, 3],
            ],
            [5, 7],
        );
        expect(x[0]).toBeCloseTo(8 / 5, 9);
        expect(x[1]).toBeCloseTo(9 / 5, 9);
    });

    it("recovers a known VAR(1) coefficient matrix", () => {
        // y_t = [1, -0.5] + [[0.8, 0.1], [-0.2, 0.6]] y_{t-1}
        const A = [
            [0.8, 0.1],
            [-0.2, 0.6],
        ];
        const c = [1, -0.5];
        const series: number[][] = [[0.3, -0.7]];
        let state: number[] = [...(series[0] as number[])];
        for (let i = 0; i < 12; i += 1) {
            state = [
                c[0]! + A[0]![0]! * state[0]! + A[0]![1]! * state[1]!,
                c[1]! + A[1]![0]! * state[0]! + A[1]![1]! * state[1]!,
            ];
            series.push([...state]);
        }
        const fit = fitVAR(series, 2);
        for (let i = 0; i < 2; i += 1) {
            expect(fit.intercept[i]).toBeCloseTo(c[i]!, 7);
            for (let j = 0; j < 2; j += 1) {
                expect(fit.transition[i]![j]).toBeCloseTo(A[i]![j]!, 7);
            }
        }
    });

    it("forecasts by applying the fitted affine map independently", () => {
        const input = mod.defaultInput as { series: number[][]; horizon: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1]?.meta as {
            transitionFlat: number[];
            intercept: number[];
            forecastFlat: number[];
            done: boolean;
        };
        expect(final.done).toBe(true);
        const transition = [
            [final.transitionFlat[0]!, final.transitionFlat[1]!],
            [final.transitionFlat[2]!, final.transitionFlat[3]!],
        ];
        let state = [...(input.series[input.series.length - 1] as number[])];
        for (let h = 0; h < input.horizon; h += 1) {
            const next = [
                final.intercept[0]! + transition[0]![0]! * state[0]! + transition[0]![1]! * state[1]!,
                final.intercept[1]! + transition[1]![0]! * state[0]! + transition[1]![1]! * state[1]!,
            ];
            expect(next[0]).toBeCloseTo(final.forecastFlat[2 * h]!, 8);
            expect(next[1]).toBeCloseTo(final.forecastFlat[2 * h + 1]!, 8);
            state = next;
        }
        expect(final.forecastFlat.length).toBe(2 * input.horizon);
        expect(varStep({ transition, intercept: final.intercept }, state).length).toBe(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
