/** newton-polygon.test.ts - Lower-hull property checks, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./newton-polygon";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.every((e) => frame.entities.some((n) => n.id === e.sourceId) && frame.entities.some((n) => n.id === e.targetId))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["points"]).toBeDefined();
    });
}

describe("Newton Polygon", () => {
    it("produces a convex lower hull above all points on random inputs", () => {
        let seed = 3;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed % 13) - 6;
        };
        for (let t = 0; t < 30; t += 1) {
            const prime = [2, 3, 5][t % 3] as number;
            const coefficients = Array.from({ length: 3 + (t % 5) }, () => rand());
            if (coefficients.every((c) => c === 0)) continue;
            const frames = [...mod.run({ prime, coefficients })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const points = final?.["points"] as Point[];
            const hull = final?.["hull"] as Point[];
            const slopes = final?.["slopes"] as number[];
            expect(points.length).toBeGreaterThan(0);
            expect(hull.length).toBeGreaterThan(0);

            const indices = points.map((p) => p[0]);
            expect(hull[0]?.[0]).toBe(Math.min(...indices));
            expect(hull[hull.length - 1]?.[0]).toBe(Math.max(...indices));

            for (let i = 0; i + 1 < slopes.length; i += 1) {
                expect(slopes[i]!).toBeLessThanOrEqual(slopes[i + 1]! + 1e-9);
            }
            for (let i = 0; i + 1 < hull.length; i += 1) {
                const left = hull[i]!;
                const right = hull[i + 1]!;
                for (const point of points) {
                    const lineY = left[1] + ((right[1] - left[1]) / (right[0] - left[0])) * (point[0] - left[0]);
                    expect(point[1]).toBeGreaterThanOrEqual(lineY - 1e-9);
                }
            }
        }
    });

    it("matches the hand-worked default example", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["hull"]).toEqual([[0, 3], [3, 0]]);
        expect(final?.["slopes"]).toEqual([-1]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
