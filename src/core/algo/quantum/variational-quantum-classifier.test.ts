/**
 * variational-quantum-classifier.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./variational-quantum-classifier";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

describe("Variational quantum classifier", () => {
    it("trains to the brute-force optimal loss and good accuracy", () => {
        const frames = [...mod.run({ hiddenTheta: 0, theta0: 1.2, learningRate: 0.15, epochs: 120 })];
        checkFrames(frames, 10);
        const metaFrame = finalMeta(frames);
        const theta = metaFrame["theta"] as number;
        const loss = metaFrame["loss"] as number;
        // Brute-force scan for the true minimum of the loss over theta.
        let bestLoss = Number.POSITIVE_INFINITY;
        for (let k = 0; k <= 2000; k += 1) {
            const t = -Math.PI + (2 * Math.PI * k) / 2000;
            let sum = 0;
            for (let i = 0; i < 10; i += 1) {
                const x = 0.1 + i * 0.3;
                const label = Math.cos(x) >= 0 ? 1 : -1;
                sum += (Math.cos(t + x) - label) ** 2;
            }
            bestLoss = Math.min(bestLoss, sum / 10);
        }
        expect(loss).toBeLessThanOrEqual(bestLoss + 0.01);
        expect(metaFrame["accuracy"] as number).toBeGreaterThanOrEqual(0.9);
        expect(Math.abs(theta)).toBeLessThan(0.2);
    });

    it("decreases the loss over training and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) {
            frames.push(frame);
        }
        checkFrames(frames, 10);
        const firstLoss = Number(frames[0]?.meta["loss"]);
        const lastLoss = Number(finalMeta(frames)["loss"]);
        expect(lastLoss).toBeLessThan(firstLoss);
        expect(generator.next().done).toBe(true);
    });

    it("handles explicit labels", () => {
        const points = [0, 1, 2, 3];
        const labels = [-1, -1, 1, 1];
        const frames = [...mod.run({ points, labels, theta0: -1.5, learningRate: 0.2, epochs: 40 })];
        checkFrames(frames, points.length);
        expect(finalMeta(frames)["accuracy"] as number).toBeGreaterThanOrEqual(0.75);
    });
});
