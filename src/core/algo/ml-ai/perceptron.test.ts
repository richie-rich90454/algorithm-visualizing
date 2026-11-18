/**
 * perceptron.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./perceptron";
import type { VisualFrame } from "@/types";

type Point = [number, number];

/** Independent reference implementation of the two-dimensional perceptron. */
function reference(points: Point[], labels: number[], epochs: number) {
    let w0 = 0;
    let w1 = 0;
    let bias = 0;
    let mistakes = 0;
    let converged = false;
    for (let epoch = 0; epoch < epochs && !converged; epoch += 1) {
        converged = true;
        for (let i = 0; i < points.length; i += 1) {
            const point = points[i];
            const target = labels[i];
            if (!point || target === undefined) {
                continue;
            }
            const score = w0 * point[0] + w1 * point[1] + bias;
            if ((score >= 0 ? 1 : -1) !== target) {
                converged = false;
                mistakes += 1;
                w0 += target * point[0];
                w1 += target * point[1];
                bias += target;
            }
        }
    }
    return { w0, w1, bias, mistakes, converged };
}

/** Check that a frame sequence is well formed and that the generator terminates. */
function checkFrames(frames: VisualFrame[], expectedPoints: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(expectedPoints);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Perceptron", () => {
    it("matches an independent reference on the default input", () => {
        const input = mod.defaultInput as { points: Point[]; labels: number[]; epochs: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(input.points, input.labels, input.epochs);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["w0"]).toBe(expected.w0);
        expect(finalMeta?.["w1"]).toBe(expected.w1);
        expect(finalMeta?.["bias"]).toBe(expected.bias);
        expect(finalMeta?.["mistakes"]).toBe(expected.mistakes);
        expect(finalMeta?.["converged"]).toBe(expected.converged);

        const w0 = Number(finalMeta?.["w0"]);
        const w1 = Number(finalMeta?.["w1"]);
        const bias = Number(finalMeta?.["bias"]);
        for (let i = 0; i < input.points.length; i += 1) {
            const point = input.points[i];
            if (point) {
                const score = w0 * point[0] + w1 * point[1] + bias;
                expect(score >= 0 ? 1 : -1).toBe(input.labels[i]);
            }
        }
    });

    it("converges on separable gates and not on XOR", () => {
        const points: Point[] = [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
        ];
        const cases: Array<{ labels: number[]; separable: boolean }> = [
            { labels: [-1, 1, 1, 1], separable: true },
            { labels: [-1, -1, -1, 1], separable: true },
            { labels: [-1, 1, 1, -1], separable: false },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ points, labels: testCase.labels, epochs: 30 })];
            const converged = frames[frames.length - 1]?.meta["converged"];
            expect(converged).toBe(testCase.separable);
            expect(frames.length).toBeGreaterThan(1);
        }
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
