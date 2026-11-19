/**
 * quantum-k-means.test.ts - Classical Lloyd cross-check, overlap-distance
 * identity, monotone objective, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-k-means";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function checkFrames(frames: VisualFrame[], count: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function classicalDistance(p: Point, c: Point): number {
    return (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2;
}

function classicalKMeans(points: Point[], iterations: number): Point[] {
    let centers: Point[] = [[...points[0]!], [...points[points.length - 1]!]];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const assignments = points.map((p) => (classicalDistance(p, centers[0]!) <= classicalDistance(p, centers[1]!) ? 0 : 1));
        const next: Point[] = [];
        let converged = true;
        for (let cluster = 0; cluster < 2; cluster += 1) {
            const members = points.filter((_p, i) => assignments[i] === cluster);
            if (members.length === 0) {
                next.push([...centers[cluster]!]);
                continue;
            }
            const mean: Point = [
                members.reduce((s, p) => s + p[0], 0) / members.length,
                members.reduce((s, p) => s + p[1], 0) / members.length,
            ];
            if (Math.hypot(mean[0] - centers[cluster]![0], mean[1] - centers[cluster]![1]) > 1e-10) converged = false;
            next.push(mean);
        }
        centers = next;
        if (converged) break;
    }
    return centers;
}

describe("QuantumKMeans", () => {
    it("reproduces classical Lloyd assignments and centers", () => {
        const points = (mod.defaultInput as { points: Point[] }).points;
        const frames = [...mod.run({ points, iterations: 3 })];
        checkFrames(frames, points.length);
        const expectedCenters = classicalKMeans(points, 3);
        const finalCenters = frames[frames.length - 1]!.meta["centers"] as number[];
        for (let i = 0; i < 4; i += 1) expect(finalCenters[i]).toBeCloseTo(expectedCenters[Math.floor(i / 2)]![i % 2]!, 10);

    });

    it("reconstructs ordinary squared distance from the quantum overlap", () => {
        const points: Point[] = [[0.1, 0.1], [1.0, 1.0]];
        const frames = [...mod.run({ points, iterations: 1 })];
        checkFrames(frames, points.length);
        const distances = frames[frames.length - 1]!.meta["distances"] as number[];
        const centers = frames[frames.length - 1]!.meta["centers"] as number[];
        const c0: Point = [centers[0]!, centers[1]!];
        const c1: Point = [centers[2]!, centers[3]!];
        for (let i = 0; i < points.length; i += 1) {
            const expected = Math.min(classicalDistance(points[i]!, c0), classicalDistance(points[i]!, c1));
            expect(distances[i]).toBeCloseTo(expected, 10);
        }
    });

    it("keeps the objective non-increasing across iterations", () => {
        const points = (mod.defaultInput as { points: Point[] }).points;
        const frames = [...mod.run({ points, iterations: 4 })];
        checkFrames(frames, points.length);
        let previous = Infinity;
        for (const frame of frames) {
            const objective = frame.meta["objective"] as number;
            expect(objective).toBeLessThanOrEqual(previous + 1e-9);
            previous = objective;
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
