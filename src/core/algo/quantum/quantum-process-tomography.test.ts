/**
 * quantum-process-tomography.test.ts - Transfer-matrix reference, prediction, orthogonality, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-process-tomography";
import type { VisualFrame } from "@/types";

type Vec3 = [number, number, number];

function referenceChannel(v: Vec3, theta: number, noise: number): Vec3 {
    const scale = 1 - noise;
    const x = scale * v[0];
    const z = scale * v[2];
    return [Math.cos(theta) * x + Math.sin(theta) * z, scale * v[1], -Math.sin(theta) * x + Math.cos(theta) * z];
}

function referenceMatrix(theta: number, noise: number): number[] {
    const s = 1 - noise;
    return [s * Math.cos(theta), 0, s * Math.sin(theta),
            0, s, 0,
            -s * Math.sin(theta), 0, s * Math.cos(theta)];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(3);
        expect(frame.entities.length).toBe(9);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["matrix"] as number[]).length).toBe(9);
    });
}

describe("QuantumProcessTomography", () => {
    it("reconstructs the exact Pauli transfer matrix", () => {
        const cases = [
            { theta: 0.7, noise: 0.15 },
            { theta: -1.1, noise: 0.4 },
            { theta: 2.0, noise: 0 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = referenceMatrix(input.theta, input.noise);
            (final?.["matrix"] as number[]).forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 12));
        }
    });

    it("predicts held-out states with no error", () => {
        const final = [...mod.run({ theta: 0.9, noise: 0.25 })].pop()?.meta;
        expect(final?.["maxError"] as number).toBeLessThan(1e-12);
        const vectors = final?.["testVectors"] as string[];
        const direct = (final?.["direct"] as string[]).map((row) => row.split(",").map(Number));
        vectors.forEach((v, i) => {
            const parts = v.split(",").map(Number);
            const expected = referenceChannel([parts[0]!, parts[1]!, parts[2]!], 0.9, 0.25);
            expected.forEach((value, j) => expect(direct[i]![j]).toBeCloseTo(value, 12));
        });
    });

    it("is orthogonal for a noiseless rotation and contracts under noise", () => {
        const noiseless = [...mod.run({ theta: 0.6, noise: 0 })].pop()?.meta;
        expect(noiseless?.["orthogonalityError"] as number).toBeLessThan(1e-12);
        const noisy = [...mod.run({ theta: 0.6, noise: 0.5 })].pop()?.meta;
        expect(noisy?.["orthogonalityError"] as number).toBeGreaterThan(0.1);
        const matrix = noisy?.["matrix"] as number[];
        expect(matrix[0]!).toBeCloseTo(0.5 * Math.cos(0.6), 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
