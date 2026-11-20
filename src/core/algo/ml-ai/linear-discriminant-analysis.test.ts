/**
 * linear-discriminant-analysis.test.ts - Independent two-class Fisher LD
 * computation, separation property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./linear-discriminant-analysis";
import type { VisualFrame } from "@/types";

type Vec2 = [number, number];

function reference(class0: Vec2[], class1: Vec2[]) {
    const mean = (points: Vec2[]): Vec2 => [
        points.reduce((s, p) => s + p[0], 0) / points.length,
        points.reduce((s, p) => s + p[1], 0) / points.length,
    ];
    const m0 = mean(class0);
    const m1 = mean(class1);
    const diff: Vec2 = [m1[0] - m0[0], m1[1] - m0[1]];
    let a = 0;
    let b = 0;
    let d = 0;
    for (const [points, m] of [[class0, m0], [class1, m1]] as Array<[Vec2[], Vec2]>) {
        for (const p of points) {
            const dx = p[0] - m[0];
            const dy = p[1] - m[1];
            a += dx * dx;
            b += dx * dy;
            d += dy * dy;
        }
    }
    const det = a * d - b * b;
    let direction: Vec2 = Math.abs(det) > 1e-12
        ? [(d * diff[0] - b * diff[1]) / det, (-b * diff[0] + a * diff[1]) / det]
        : [...diff];
    const norm = Math.hypot(direction[0], direction[1]) || 1;
    const w: Vec2 = [direction[0] / norm, direction[1] / norm];
    const project = (p: Vec2) => w[0] * p[0] + w[1] * p[1];
    const threshold = (project(m0) + project(m1)) / 2;
    const all = [...class0, ...class1];
    const projections = all.map(project);
    let correct = 0;
    projections.forEach((value, i) => {
        if ((value >= threshold ? 1 : 0) === (i < class0.length ? 0 : 1)) correct += 1;
    });
    return { m0, m1, sw: [a, b, b, d], w, threshold, projections, accuracy: correct / all.length };
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("FisherLDA", () => {
    it("matches an independent scatter and projection computation", () => {
        const input = mod.defaultInput as { class0: Vec2[]; class1: Vec2[] };
        const frames = [...mod.run(input)];
        const all = [...input.class0, ...input.class1];
        checkFrames(frames, all.length);
        const expected = reference(input.class0, input.class1);
        const final = frames[frames.length - 1]?.meta;
        const actualM0 = final?.["m0"] as number[];
        const actualM1 = final?.["m1"] as number[];
        const actualSw = final?.["sw"] as number[];
        const actualW = final?.["w"] as number[];
        const actualProj = final?.["projections"] as number[];
        actualM0.forEach((v, i) => expect(Math.abs(v - (expected.m0[i] ?? 0))).toBeLessThan(1e-9));
        actualM1.forEach((v, i) => expect(Math.abs(v - (expected.m1[i] ?? 0))).toBeLessThan(1e-9));
        actualSw.forEach((v, i) => expect(Math.abs(v - (expected.sw[i] ?? 0))).toBeLessThan(1e-9));
        actualW.forEach((v, i) => expect(Math.abs(v - (expected.w[i] ?? 0))).toBeLessThan(1e-6));
        actualProj.forEach((v, i) => expect(Math.abs(v - (expected.projections[i] ?? 0))).toBeLessThan(1e-6));
        expect(Math.abs((final?.["threshold"] as number) - expected.threshold)).toBeLessThan(1e-6);
        expect(final?.["accuracy"]).toBe(expected.accuracy);
    });

    it("separates the projected class means and classifies perfectly", () => {
        const input = mod.defaultInput as { class0: Vec2[]; class1: Vec2[] };
        const final = [...mod.run(input)].pop()?.meta;
        const w = final?.["w"] as number[];
        const m0 = final?.["m0"] as number[];
        const m1 = final?.["m1"] as number[];
        const proj0 = (w[0] ?? 0) * (m0[0] ?? 0) + (w[1] ?? 0) * (m0[1] ?? 0);
        const proj1 = (w[0] ?? 0) * (m1[0] ?? 0) + (w[1] ?? 0) * (m1[1] ?? 0);
        expect(proj1).toBeGreaterThan(proj0);
        expect(final?.["accuracy"]).toBe(1);
        expect(Math.hypot(w[0] ?? 0, w[1] ?? 0)).toBeCloseTo(1, 6);
    });

    it("handles a singular scatter via the mean difference fallback", () => {
        const input = { class0: [[0, 0], [0, 0]] as Vec2[], class1: [[2, 2], [2, 2]] as Vec2[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, 4);
        const final = frames[frames.length - 1]?.meta;
        const w = final?.["w"] as number[];
        expect(w[0]).toBeGreaterThan(0);
        expect(w[1]).toBeGreaterThan(0);
        expect(final?.["accuracy"]).toBe(1);
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
