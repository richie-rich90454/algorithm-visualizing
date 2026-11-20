/**
 * quantum-extreme-learning-machine.test.ts - Independent random-feature circuit
 * and least-squares cross-check, accuracy checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-extreme-learning-machine";
import type { VisualFrame } from "@/types";

type C = [number, number];

const TRAIN: Array<[number, number]> = [
    [0.1, 0.1], [0.2, 0.8], [0.35, 0.5], [0.5, 0.15],
    [0.65, 0.7], [0.8, 0.2], [0.85, 0.85], [0.15, 0.4],
];
const TEST: Array<[number, number]> = [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]];

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
        const features = frame.meta["trainFeaturesFlat"] as number[];
        expect(features.length).toBe(32);
    });
}

function expectedAngles(seed: number): number[] {
    let value = seed >>> 0 || 1;
    return Array.from({ length: 4 }, () => {
        value = (1664525 * value + 1013904223) >>> 0;
        return (value / 2 ** 32) * Math.PI;
    });
}

/** Independent feature map built by applying explicit two-by-two matrices. */
function expectedFeatures(point: [number, number], angles: number[]): number[] {
    const state: C[] = [[1, 0], [0, 0], [0, 0], [0, 0]];
    const rotate = (qubit: number, angle: number): void => {
        const stride = 2 ** qubit;
        const c = Math.cos(angle / 2);
        const s = Math.sin(angle / 2);
        for (let base = 0; base < 4; base += 2 * stride) {
            const a = state[base]!;
            const b = state[base + stride]!;
            state[base] = [c * a[0] - s * b[0], c * a[1] - s * b[1]];
            state[base + stride] = [s * a[0] + c * b[0], s * a[1] + c * b[1]];
        }
    };
    const phase = (qubit: number, angle: number): void => {
        const c = Math.cos(angle / 2);
        const s = Math.sin(angle / 2);
        for (let i = 0; i < 4; i += 1) {
            const factor: C = ((i >> qubit) & 1) === 1 ? [c, s] : [c, -s];
            const z = state[i]!;
            state[i] = [z[0] * factor[0] - z[1] * factor[1], z[0] * factor[1] + z[1] * factor[0]];
        }
    };
    rotate(0, Math.PI * point[0] + angles[0]!);
    rotate(1, Math.PI * point[1] + angles[1]!);
    const tmp = state[1]!;
    state[1] = state[2]!;
    state[2] = tmp;
    phase(0, angles[2]!);
    phase(1, angles[3]!);
    const z = (qubit: number): number => state.reduce((sum, amplitude, i) => {
        const probability = amplitude[0] ** 2 + amplitude[1] ** 2;
        return sum + (((i >> qubit) & 1) === 0 ? probability : -probability);
    }, 0);
    const z0 = z(0);
    const z1 = z(1);
    return [1, z0, z1, z0 * z1];
}

function expectedWeights(features: number[][], labels: number[]): number[] {
    const gram = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) =>
        features.reduce((sum, row) => sum + row[i]! * row[j]!, 0) + (i === j ? 1e-6 : 0)));
    const moment = Array.from({ length: 4 }, (_, i) => features.reduce((sum, row, k) => sum + row[i]! * labels[k]!, 0));
    const rows = gram.map((row, i) => [...row, moment[i]!]);
    for (let column = 0; column < 4; column += 1) {
        let pivot = column;
        for (let r = column + 1; r < 4; r += 1) if (Math.abs(rows[r]![column]!) > Math.abs(rows[pivot]![column]!)) pivot = r;
        const tmp = rows[column]!;
        rows[column] = rows[pivot]!;
        rows[pivot] = tmp;
        const divisor = rows[column]![column]!;
        for (let j = column; j <= 4; j += 1) rows[column]![j] /= divisor;
        for (let r = 0; r < 4; r += 1) {
            if (r === column) continue;
            const factor = rows[r]![column]!;
            for (let j = column; j <= 4; j += 1) rows[r]![j] -= factor * rows[column]![j]!;
        }
    }
    return rows.map((row) => row[4]!);
}

const label = (point: [number, number]): number => (point[0] - 0.5) ** 2 + (point[1] - 0.5) ** 2 < 0.06 ? 1 : -1;

describe("QuantumExtremeLearningMachine", () => {
    it("matches independently computed features, weights, and predictions", () => {
        const seed = 7;
        const frames = [...mod.run({ seed })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const angles = expectedAngles(seed);
        expect(final["angles"]).toEqual(angles);
        const features = TRAIN.map((point) => expectedFeatures(point, angles));
        const flat = final["trainFeaturesFlat"] as number[];
        for (let i = 0; i < features.length; i += 1) {
            for (let j = 0; j < 4; j += 1) expect(flat[4 * i + j]).toBeCloseTo(features[i]![j]!, 11);
        }
        const labels = TRAIN.map(label);
        const weights = expectedWeights(features, labels);
        const reported = final["weights"] as number[];
        for (let i = 0; i < 4; i += 1) expect(reported[i]).toBeCloseTo(weights[i]!, 8);
        const predict = (row: number[]): number => row.reduce((sum, value, i) => sum + value * weights[i]!, 0) >= 0 ? 1 : -1;
        const expectedTrain = features.map(predict);
        expect(final["trainPredictions"]).toEqual(expectedTrain);
        const expectedTest = TEST.map((point) => predict(expectedFeatures(point, angles)));
        expect(final["testPredictions"]).toEqual(expectedTest);
    });

    it("reports reproducible accuracies for the seeded task", () => {
        const frames = [...mod.run({ seed: 7 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(final["trainAccuracy"]).toBeGreaterThanOrEqual(0.75);
        expect(final["testAccuracy"]).toBeGreaterThanOrEqual(0.5);
        const repeat = [...mod.run({ seed: 7 })];
        expect(repeat[repeat.length - 1]!.meta["weights"]).toEqual(final["weights"]);
    });

    it("clamps the seed to a usable value", () => {
        const frames = [...mod.run({ seed: Number.NaN })];
        checkFrames(frames);
        expect(frames[0]!.meta["seed"]).toBe(7);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});
