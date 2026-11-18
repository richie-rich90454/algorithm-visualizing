/**
 * principal-component-analysis.test.ts - Eigenvector and eigenvalue checks
 * against the analytic 2 by 2 solution, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./principal-component-analysis";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n + 2);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
    });
}

describe("Principal Component Analysis", () => {
    it("finds the leading eigenvector and eigenvalue of the scatter matrix", () => {
        const input = mod.defaultInput as { points: Point[]; iterations: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);

        const n = input.points.length;
        const mx = input.points.reduce((sum, p) => sum + p[0], 0) / n;
        const my = input.points.reduce((sum, p) => sum + p[1], 0) / n;
        let a = 0;
        let b = 0;
        let c = 0;
        for (const [x, y] of input.points) {
            a += (x - mx) * (x - mx);
            b += (x - mx) * (y - my);
            c += (y - my) * (y - my);
        }
        const expectedLambda = (a + c + Math.sqrt((a - c) * (a - c) + 4 * b * b)) / 2;
        const trace = a + c;

        const final = frames[frames.length - 1]?.meta;
        const v = final?.["vector"] as number[];
        const lambda = Number(final?.["eigenvalue"]);
        expect(lambda).toBeCloseTo(expectedLambda, 4);
        expect(Number(final?.["variance"])).toBeCloseTo(expectedLambda / trace, 4);
        expect(Math.hypot(v[0] ?? 0, v[1] ?? 0)).toBeCloseTo(1, 8);

        const Av = [
            a * (v[0] ?? 0) + b * (v[1] ?? 0),
            b * (v[0] ?? 0) + c * (v[1] ?? 0),
        ];
        expect(Av[0]).toBeCloseTo(lambda * (v[0] ?? 0), 4);
        expect(Av[1]).toBeCloseTo(lambda * (v[1] ?? 0), 4);

        const analytic: number[] =
            Math.abs(b) > 1e-12
                ? [expectedLambda - c, b]
                : a >= c
                  ? [1, 0]
                  : [0, 1];
        const analyticNorm = Math.hypot(analytic[0] ?? 0, analytic[1] ?? 0);
        const alignment =
            Math.abs(
                ((v[0] ?? 0) * (analytic[0] ?? 0) + (v[1] ?? 0) * (analytic[1] ?? 0)) /
                    (analyticNorm || 1),
            );
        expect(alignment).toBeCloseTo(1, 4);
    });

    it("captures nearly all variance on a clean line and orthogonal second component", () => {
        const points: Point[] = [
            [0, 0],
            [1, 2],
            [2, 4],
            [3, 6],
        ];
        const frames = [...mod.run({ points, iterations: 30 })];
        checkFrames(frames, points.length);
        const final = frames[frames.length - 1]?.meta;
        const v = final?.["vector"] as number[];
        const v2 = final?.["secondVector"] as number[];
        expect(Number(final?.["variance"])).toBeGreaterThan(0.999);
        expect(Math.abs(v[0] ?? 0)).toBeCloseTo(1 / Math.sqrt(5), 3);
        expect(Math.abs(v[1] ?? 0)).toBeCloseTo(2 / Math.sqrt(5), 3);
        expect(Math.abs((v[0] ?? 0) * (v2[0] ?? 0) + (v[1] ?? 0) * (v2[1] ?? 0))).toBeCloseTo(0, 3);
    });

    it("increases the Rayleigh quotient monotonically across iterations", () => {
        const frames = [...mod.run({ iterations: 10 })];
        checkFrames(frames, 6);
        const lambda = frames.slice(1, -1).map((frame) => Number(frame.meta["eigenvalue"]));
        for (let i = 1; i < lambda.length; i += 1) {
            expect(lambda[i] ?? 0).toBeGreaterThanOrEqual((lambda[i - 1] ?? 0) - 1e-9);
        }
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
