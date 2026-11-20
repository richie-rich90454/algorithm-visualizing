/**
 * support-vector-machine-smooth.test.ts - Finite-difference gradient check, objective descent, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./support-vector-machine-smooth";
import type { VisualFrame } from "@/types";

type Point = [number, number];
interface Input {
    points: Point[];
    labels: number[];
    lr: number;
    C: number;
    iterations: number;
}

function lossAt(points: Point[], labels: number[], w: number[], b: number, C: number): number {
    let total = 0.5 * (w[0]! ** 2 + w[1]! ** 2);
    for (let i = 0; i < points.length; i += 1) {
        const p = points[i]!;
        const margin = labels[i]! * (w[0]! * p[0]! + w[1]! * p[1]! + b);
        total += C * Math.max(0, 1 - margin) ** 2;
    }
    return total;
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("SmoothMarginSVM", () => {
    it("analytic gradient matches central finite differences", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const eps = 1e-5;
        for (const frame of frames.slice(0, frames.length - 1)) {
            const w0 = Number(frame.meta["w0"]);
            const w1 = Number(frame.meta["w1"]);
            const b = Number(frame.meta["b"]);
            const g0 = Number(frame.meta["g0"]);
            const g1 = Number(frame.meta["g1"]);
            const gb = Number(frame.meta["gb"]);
            const num0 = (lossAt(input.points, input.labels, [w0 + eps, w1], b, input.C) - lossAt(input.points, input.labels, [w0 - eps, w1], b, input.C)) / (2 * eps);
            const num1 = (lossAt(input.points, input.labels, [w0, w1 + eps], b, input.C) - lossAt(input.points, input.labels, [w0, w1 - eps], b, input.C)) / (2 * eps);
            const numb = (lossAt(input.points, input.labels, [w0, w1], b + eps, input.C) - lossAt(input.points, input.labels, [w0, w1], b - eps, input.C)) / (2 * eps);
            expect(g0).toBeCloseTo(num0, 4);
            expect(g1).toBeCloseTo(num1, 4);
            expect(gb).toBeCloseTo(numb, 4);
        }
    });

    it("decreases the objective and separates the training data", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const losses = frames.map((f) => Number(f.meta["loss"]));
        for (let i = 1; i < losses.length; i += 1) {
            expect(losses[i] ?? Infinity).toBeLessThanOrEqual((losses[i - 1] ?? 0) + 1e-9);
        }
        const finalMeta = frames[frames.length - 1]?.meta ?? {};
        expect(finalMeta["correct"]).toBe(input.points.length);
        expect(losses[losses.length - 1]!).toBeLessThan(losses[0]!);
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
