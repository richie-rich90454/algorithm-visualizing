/**
 * k-means-plus-plus-seeding.test.ts - Weighted-sampling property, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./k-means-plus-plus-seeding";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function checkFrames(frames: VisualFrame[], pointCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(pointCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const centers = frame.meta["centers"] as number[];
        expect(new Set(centers).size).toBe(centers.length);
    });
}

function bruteDistances(points: Point[], centers: number[]): number[] {
    return points.map((point) => {
        let best = Infinity;
        for (const ci of centers) {
            const center = points[ci]!;
            best = Math.min(best, (point[0] - center[0]) ** 2 + (point[1] - center[1]) ** 2);
        }
        return best;
    });
}

describe("KMeansPlusPlusSeeding", () => {
    it("uses exact squared-distance weights and picks distinct data points", () => {
        const input = mod.defaultInput as { points: Point[]; k: number; seed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        const centers = finalMeta?.["centers"] as number[];
        expect(centers).toHaveLength(input.k);
        expect(new Set(centers).size).toBe(input.k);
        for (const ci of centers) {
            expect(ci).toBeGreaterThanOrEqual(0);
            expect(ci).toBeLessThan(input.points.length);
        }

        const weightedFrames = frames.filter((frame) =>
            Array.isArray(frame.meta["squaredDistances"]),
        );
        expect(weightedFrames.length).toBeGreaterThan(0);
        for (const frame of weightedFrames) {
            const priorCenters = (frame.meta["centers"] as number[]).slice(0, -1);
            const expected = bruteDistances(input.points, priorCenters);
            const emitted = frame.meta["squaredDistances"] as number[];
            for (let i = 0; i < expected.length; i += 1) {
                expect(emitted[i]).toBeCloseTo(Number.isFinite(expected[i]!) ? expected[i]! : 0, 3);
            }
            const total = expected.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
            expect(Number(frame.meta["totalWeight"])).toBeCloseTo(total, 3);
        }
    });

    it("is deterministic for a fixed seed and covers distant clusters", () => {
        const input = mod.defaultInput as { points: Point[]; k: number; seed: number };
        const a = [...mod.run(input)].map((f) => f.meta["centers"]);
        const b = [...mod.run(input)].map((f) => f.meta["centers"]);
        expect(a).toEqual(b);

        for (const seed of [1, 2, 7, 19, 99]) {
            const frames = [...mod.run({ ...input, seed })];
            checkFrames(frames, input.points.length);
            const centers = frames[frames.length - 1]?.meta["centers"] as number[];
            expect(centers).toHaveLength(3);
            const groups = new Set(centers.map((ci) => Math.sign(input.points[ci]![0])));
            expect(groups.size).toBeGreaterThanOrEqual(2);
        }
    });

    it("handles k equal to the number of points and terminates cleanly", () => {
        const points: Point[] = [
            [0, 0],
            [1, 0],
            [0, 1],
        ];
        const generator = mod.run({ points, k: 3, seed: 4 });
        const frames = [...generator];
        checkFrames(frames, points.length);
        expect(new Set(frames[frames.length - 1]?.meta["centers"] as number[]).size).toBe(3);
        expect(generator.next().done).toBe(true);
    });
});
