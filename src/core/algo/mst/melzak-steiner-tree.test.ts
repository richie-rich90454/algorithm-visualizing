/**
 * melzak-steiner-tree.test.ts - known optimal geometric lengths and frame shape.
 */
import { describe, expect, it } from "vitest";
import mod from "./melzak-steiner-tree";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function mstLength(points: Point[]): number {
    const n = points.length;
    const inTree = new Set<number>([0]);
    let total = 0;
    while (inTree.size < n) {
        let best = Infinity;
        let next = -1;
        for (const i of inTree) {
            for (let j = 0; j < n; j += 1) {
                if (inTree.has(j)) continue;
                const d = Math.hypot(points[i]![0] - points[j]![0], points[i]![1] - points[j]![1]);
                if (d < best) {
                    best = d;
                    next = j;
                }
            }
        }
        if (next < 0) break;
        inTree.add(next);
        total += best;
    }
    return total;
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

function evaluate(terminals: Point[]) {
    const frames = [...mod.run({ terminals })];
    checkFrames(frames);
    const final = frames[frames.length - 1]?.meta as Record<string, unknown>;
    return { frames, cost: Number(final["cost"]) };
}

describe("Melzak Steiner Tree", () => {
    it("matches the known optimum for a unit square", () => {
        const result = evaluate([[0, 0], [1, 0], [1, 1], [0, 1]]);
        expect(result.cost).toBeCloseTo(1 + Math.sqrt(3), 6);
        expect(result.cost).toBeLessThanOrEqual(mstLength([[0, 0], [1, 0], [1, 1], [0, 1]]) + 1e-9);
    });

    it("matches the Fermat length for an equilateral triangle", () => {
        const h = Math.sqrt(3);
        const result = evaluate([[0, 0], [2, 0], [1, h]]);
        expect(result.cost).toBeCloseTo(2 * Math.sqrt(3), 6);
    });

    it("matches the direct distance for two terminals", () => {
        const result = evaluate([[0, 0], [3, 4]]);
        expect(result.cost).toBeCloseTo(5, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
