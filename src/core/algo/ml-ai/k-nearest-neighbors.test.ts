/**
 * k-nearest-neighbors.test.ts - Brute-force vote checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./k-nearest-neighbors";
import type { VisualFrame } from "@/types";

type Point = [number, number];

/** Independent brute-force k-NN vote. */
function bruteForce(points: Point[], labels: number[], query: Point, k: number) {
    const measured = points
        .map((point, index) => ({
            index,
            distance: Math.hypot(point[0] - query[0], point[1] - query[1]),
            label: labels[index] ?? 0,
        }))
        .sort((a, b) => a.distance - b.distance || a.index - b.index);
    const chosen = measured.slice(0, k);
    const counts = new Map<number, number>();
    for (const item of chosen) {
        counts.set(item.label, (counts.get(item.label) ?? 0) + 1);
    }
    let best = -1;
    let label = chosen[0]?.label ?? 0;
    for (const item of chosen) {
        const count = counts.get(item.label) ?? 0;
        if (count > best) {
            best = count;
            label = item.label;
        }
    }
    return { prediction: label, neighbors: chosen.map((item) => item.index) };
}

/** Check frame shape and clean termination. */
function checkFrames(frames: VisualFrame[], expectedEntities: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(expectedEntities);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    const edges = frames[frames.length - 1]?.edges ?? [];
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
        const ids = new Set(frames[frames.length - 1]?.entities.map((e) => e.id));
        expect(ids.has(edge.sourceId)).toBe(true);
        expect(ids.has(edge.targetId)).toBe(true);
    }
}

describe("KNearestNeighbors", () => {
    it("agrees with a brute-force vote on several queries", () => {
        const input = mod.defaultInput as { points: Point[]; labels: number[]; query: Point; k: number };
        const queries: Point[] = [
            input.query,
            [1.8, 1.6],
            [0.2, 0.3],
            [2.0, 1.9],
        ];
        for (const query of queries) {
            for (const k of [1, 3, 5]) {
                const frames = [...mod.run({ ...input, query, k })];
                checkFrames(frames, input.points.length + 1);
                const expected = bruteForce(input.points, input.labels, query, k);
                const meta = frames[frames.length - 1]?.meta;
                expect(meta?.["prediction"]).toBe(expected.prediction);
                expect(meta?.["neighbors"]).toEqual(expected.neighbors);

                const distances = meta?.["distances"] as number[] | undefined;
                expect(distances?.length).toBe(k);
                const sorted = [...(distances ?? [])].sort((a, b) => a - b);
                expect(distances).toEqual(sorted);
                for (const item of expected.neighbors) {
                    const point = input.points[item];
                    if (point) {
                        const exact = Math.hypot(point[0] - query[0], point[1] - query[1]);
                        expect(Math.min(...(distances ?? []).map((d) => Math.abs(d - exact)))).toBeLessThan(0.0002);
                    }
                }
            }
        }
    });

    it("clamps k to the number of available points", () => {
        const input = mod.defaultInput as { points: Point[]; labels: number[]; query: Point };
        const frames = [...mod.run({ ...input, k: 99 })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["k"]).toBe(input.points.length);
        expect((meta?.["neighbors"] as number[]).length).toBe(input.points.length);
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
