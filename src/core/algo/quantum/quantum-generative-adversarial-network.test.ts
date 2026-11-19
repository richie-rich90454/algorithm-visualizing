/**
 * quantum-generative-adversarial-network.test.ts - Finite-difference gradient
 * checks, probability bounds, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-generative-adversarial-network";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const p = frame.meta["generatorProbabilities"] as number[];
        expect(p.length).toBe(2);
        expect(p[0]! + p[1]!).toBeCloseTo(1, 10);
        const d = frame.meta["discriminatorOutputs"] as number[];
        expect(d.every((value) => value > 0 && value < 1)).toBe(true);
    });
}

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

function discriminatorLoss(target: number, p0: number, p1: number, a: number, b: number): number {
    const d0 = sigmoid(b);
    const d1 = sigmoid(a + b);
    return -(target * Math.log(d0) + (1 - target) * Math.log(d1) + p0 * Math.log(1 - d0) + p1 * Math.log(1 - d1));
}

function generatorLoss(theta: number, a: number, b: number): number {
    const p0 = Math.cos(theta / 2) ** 2;
    const p1 = Math.sin(theta / 2) ** 2;
    return -(p0 * Math.log(sigmoid(b)) + p1 * Math.log(sigmoid(a + b)));
}

describe("QuantumGenerativeAdversarialNetwork", () => {
    it("matches finite-difference minimax gradients at every epoch", () => {
        const input = { target: 0.4, epochs: 5, lr: 0.15 };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const epsilon = 1e-6;
        for (let epoch = 1; epoch <= input.epochs; epoch += 1) {
            const before = frames[epoch - 1]!.meta;
            const after = frames[epoch]!.meta;
            const theta = before["theta"] as number;
            const a = before["discriminatorWeight"] as number;
            const b = before["discriminatorBias"] as number;
            const p0 = Math.cos(theta / 2) ** 2;
            const p1 = Math.sin(theta / 2) ** 2;
            const fdA = (discriminatorLoss(0.4, p0, p1, a + epsilon, b) - discriminatorLoss(0.4, p0, p1, a - epsilon, b)) / (2 * epsilon);
            const fdB = (discriminatorLoss(0.4, p0, p1, a, b + epsilon) - discriminatorLoss(0.4, p0, p1, a, b - epsilon)) / (2 * epsilon);
            const fdTheta = -(generatorLoss(theta + epsilon, a, b) - generatorLoss(theta - epsilon, a, b)) / (2 * epsilon);
            const gradD = after["gradD"] as number[];
            expect(gradD[0]).toBeCloseTo(fdA, 7);
            expect(gradD[1]).toBeCloseTo(fdB, 7);
            expect(after["gradG"]).toBeCloseTo(fdTheta, 7);
        }
    });

    it("moves the generator toward the target distribution", () => {
        const frames = [...mod.run({ target: 0.3, epochs: 8, lr: 0.25 })];
        checkFrames(frames);
        const initial = (frames[0]!.meta["generatorProbabilities"] as number[])[0]!;
        const final = (frames[frames.length - 1]!.meta["generatorProbabilities"] as number[])[0]!;
        expect(Math.abs(final - 0.3)).toBeLessThan(Math.abs(initial - 0.3));
    });

    it("clamps the learning parameters", () => {
        const frames = [...mod.run({ target: 9, epochs: 0, lr: -1 })];
        checkFrames(frames);
        expect(frames[0]!.meta["target"]).toBe(0.95);
        expect(frames[frames.length - 1]!.meta["epochs"]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
