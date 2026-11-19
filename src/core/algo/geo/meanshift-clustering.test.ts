/** meanshift-clustering.test.ts - Density local-maximum check, assignment check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./meanshift-clustering";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function density(point: Point, points: Point[], h: number): number {
    return points.reduce((sum, p) => sum + Math.exp(-((point[0] - p[0]) ** 2 + (point[1] - p[1]) ** 2) / (2 * h * h)), 0);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Mean Shift Clustering", () => {
    it("converges to local density maxima", () => {
        const input = mod.defaultInput as { points: Point[]; bandwidth: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const xs = meta?.["modeXs"] as number[];
        const ys = meta?.["modeYs"] as number[];
        expect(xs.length).toBeGreaterThan(0);
        const epsilon = 0.05;
        for (let i = 0; i < xs.length; i += 1) {
            const mode: Point = [xs[i] as number, ys[i] as number];
            const here = density(mode, input.points, input.bandwidth);
            for (const [dx, dy] of [[epsilon, 0], [-epsilon, 0], [0, epsilon], [0, -epsilon]] as Point[]) {
                expect(here).toBeGreaterThanOrEqual(density([mode[0] + dx, mode[1] + dy], input.points, input.bandwidth) - 1e-6);
            }
        }
    });

    it("assigns every point to its nearest mode", () => {
        const input = mod.defaultInput as { points: Point[]; bandwidth: number };
        const frames = [...mod.run(input)];
        const meta = frames[frames.length - 1]?.meta;
        const xs = meta?.["modeXs"] as number[];
        const ys = meta?.["modeYs"] as number[];
        const assignments = meta?.["assignments"] as number[];
        expect(assignments).toHaveLength(input.points.length);
        input.points.forEach((point, i) => {
            let nearest = 0;
            let best = Infinity;
            xs.forEach((mx, k) => {
                const d = Math.hypot(mx - point[0], (ys[k] as number) - point[1]);
                if (d < best) {
                    best = d;
                    nearest = k;
                }
            });
            expect(assignments[i]).toBe(nearest);
        });
        expect(new Set(assignments).size).toBe(xs.length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
