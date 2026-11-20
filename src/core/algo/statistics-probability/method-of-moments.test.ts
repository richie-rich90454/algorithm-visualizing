/**
 * method-of-moments.test.ts - Moment equations, parameter recovery from seeded samples, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./method-of-moments";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(Number.isFinite(entity.value as number)).toBe(true);
            expect(entity.metadata).toBeDefined();
        }
    });
}

function lastMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

describe("MethodOfMoments", () => {
    it("solves the moment equations exactly on explicit data", () => {
        const data = [1, 2, 3, 4, 5];
        const mean = 3;
        const variance = 2;

        const exponential = [...mod.run({ family: "exponential", data })];
        checkFrames(exponential);
        expect(1 / Number(lastMeta(exponential)["lambdaHat"])).toBeCloseTo(mean, 12);

        const normal = [...mod.run({ family: "normal", data })];
        checkFrames(normal);
        const normalMeta = lastMeta(normal);
        expect(Number(normalMeta["muHat"])).toBeCloseTo(mean, 12);
        expect(Number(normalMeta["sigmaHat"]) ** 2).toBeCloseTo(variance, 12);

        const uniform = [...mod.run({ family: "uniform", data })];
        checkFrames(uniform);
        expect(Number(lastMeta(uniform)["thetaHat"]) / 2).toBeCloseTo(mean, 12);

        const gamma = [...mod.run({ family: "gamma", data })];
        checkFrames(gamma);
        const gammaMeta = lastMeta(gamma);
        const shape = Number(gammaMeta["shapeHat"]);
        const scale = Number(gammaMeta["scaleHat"]);
        expect(shape * scale).toBeCloseTo(mean, 12);
        expect(shape * scale * scale).toBeCloseTo(variance, 12);
    });

    it("recovers exponential and uniform parameters from large seeded samples", () => {
        const exponential = [...mod.run({ family: "exponential", lambda: 0.5, count: 20000, seed: 11 })];
        checkFrames(exponential);
        expect(Number(lastMeta(exponential)["lambdaHat"])).toBeGreaterThan(0.45);
        expect(Number(lastMeta(exponential)["lambdaHat"])).toBeLessThan(0.55);

        const uniform = [...mod.run({ family: "uniform", theta: 10, count: 20000, seed: 12 })];
        checkFrames(uniform);
        expect(Number(lastMeta(uniform)["thetaHat"])).toBeGreaterThan(9.5);
        expect(Number(lastMeta(uniform)["thetaHat"])).toBeLessThan(10.5);
    });

    it("recovers normal and gamma parameters from large seeded samples", () => {
        const normal = [...mod.run({ family: "normal", mu: 2, sigma: 3, count: 20000, seed: 21 })];
        checkFrames(normal);
        const normalMeta = lastMeta(normal);
        expect(Math.abs(Number(normalMeta["muHat"]) - 2)).toBeLessThan(0.1);
        expect(Math.abs(Number(normalMeta["sigmaHat"]) - 3)).toBeLessThan(0.15);

        const gamma = [...mod.run({ family: "gamma", alpha: 2, beta: 2, count: 20000, seed: 22 })];
        checkFrames(gamma);
        const gammaMeta = lastMeta(gamma);
        expect(Math.abs(Number(gammaMeta["shapeHat"]) - 2)).toBeLessThan(0.25);
        expect(Math.abs(Number(gammaMeta["scaleHat"]) - 2)).toBeLessThan(0.25);
    });

    it("handles a constant sample without throwing", () => {
        const frames = [...mod.run({ family: "normal", data: [4, 4, 4, 4] })];
        checkFrames(frames);
        expect(Number(lastMeta(frames)["muHat"])).toBeCloseTo(4, 12);
        expect(Number(lastMeta(frames)["sigmaHat"])).toBeCloseTo(0, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
