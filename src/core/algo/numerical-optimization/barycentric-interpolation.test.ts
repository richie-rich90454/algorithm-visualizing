/**
 * barycentric-interpolation.test.ts - Interpolation correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./barycentric-interpolation";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent Lagrange evaluation at a point, used as a reference. */
function lagrange(nodes: Point[], x: number): number {
    let result = 0;
    for (let i = 0; i < nodes.length; i += 1) {
        const [xi, yi] = nodes[i] as Point;
        let term = yi;
        for (let j = 0; j < nodes.length; j += 1) {
            if (i === j) {
                continue;
            }
            const xj = (nodes[j] as Point)[0];
            term *= (x - xj) / (xi - xj);
        }
        result += term;
    }
    return result;
}

describe("Barycentric Interpolation", () => {
    it("matches an independent Lagrange evaluator at arbitrary queries", () => {
        const nodes: Point[] = [
            [-1, -1],
            [0, 0],
            [0.5, 0.125],
            [1, 1],
            [2, 8],
        ];
        const queries = [-0.7, -0.1, 0.25, 0.75, 1.4];
        const frames = [...mod.run({ nodes, queries })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta["values"] as number[];
        expect(final.length).toBe(queries.length);
        queries.forEach((x, i) => {
            expect(final[i] as number).toBeCloseTo(lagrange(nodes, x), 9);
        });
    });

    it("returns stored values exactly at the nodes", () => {
        const nodes: Point[] = [
            [0, 3],
            [1, 5],
            [2, 11],
        ];
        const frames = [...mod.run({ nodes, queries: [0, 1, 2] })];
        const final = frames[frames.length - 1]?.meta["values"] as number[];
        expect(final[0]).toBe(3);
        expect(final[1]).toBe(5);
        expect(final[2]).toBe(11);
        expect(frames.some((f) => f.meta["directNode"] === true)).toBe(true);
    });

    it("rejects duplicate node abscissas", () => {
        const frames = [...mod.run({ nodes: [[0, 1], [0, 2]], queries: [0.5] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["valid"]).toBe(false);
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
