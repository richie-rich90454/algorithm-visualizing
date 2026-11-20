/**
 * held-karp-one-tree.test.ts - lower bound never exceeds the optimal TSP tour.
 */
import { describe, expect, it } from "vitest";
import mod from "./held-karp-one-tree";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function optimalTour(points: Point[]): number {
    const n = points.length;
    const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const visited = Array.from({ length: n }, () => false);
    let best = Infinity;
    const walk = (at: number, depth: number, cost: number): void => {
        if (depth === n) {
            best = Math.min(best, cost + dist(points[at] as Point, points[0] as Point));
            return;
        }
        for (let next = 1; next < n; next += 1) {
            if (visited[next]) continue;
            visited[next] = true;
            walk(next, depth + 1, cost + dist(points[at] as Point, points[next] as Point));
            visited[next] = false;
        }
    };
    walk(0, 1, 0);
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    const seen = new Set<number>();
    frames.forEach((frame) => {
        expect(frame.layout).toBe("point");
        expect(seen.has(frame.stepNumber)).toBe(false);
        seen.add(frame.stepNumber);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    frames.forEach((frame, i) => expect(frame.stepNumber).toBe(i));
}

function evaluate(points: Point[], iterations: number) {
    const frames = [...mod.run({ points, iterations })];
    checkFrames(frames);
    const final = frames[frames.length - 1]?.meta as Record<string, unknown>;
    return { frames, bound: Number(final["bound"]), final };
}

describe("Held-Karp 1-Tree Lower Bound", () => {
    it("stays below the optimal tour on the default input", () => {
        const input = mod.defaultInput as { points: Point[]; iterations: number };
        const result = evaluate(input.points, input.iterations);
        expect(result.bound).toBeLessThanOrEqual(optimalTour(input.points) + 1e-6);
        expect(result.bound).toBeGreaterThan(0);
        expect(result.final["rootDegree"]).toBe(2);
    });

    it("stays below the optimal tour on random point sets", () => {
        let seed = 307;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        for (let trial = 0; trial < 15; trial += 1) {
            const points: Point[] = Array.from({ length: 5 }, () => [Math.round(rand() * 10), Math.round(rand() * 10)]);
            const result = evaluate(points, 6);
            expect(result.bound).toBeLessThanOrEqual(optimalTour(points) + 1e-6);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
