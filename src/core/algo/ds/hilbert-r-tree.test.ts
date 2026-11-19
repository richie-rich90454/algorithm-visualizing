/** hilbert-r-tree.test.ts - Brute-force window query cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./hilbert-r-tree";
import type { VisualFrame } from "@/types";

type Rect = [number, number, number, number];
const overlaps = (a: Rect, b: Rect): boolean => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Hilbert R-Tree", () => {
    it("answers window queries identically to a brute-force scan", () => {
        const input = mod.defaultInput as { rectangles: Rect[]; queries: Rect[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const results = JSON.parse(frames[frames.length - 1]?.meta["resultsJson"] as string) as string[][];
        expect(results).toHaveLength(input.queries.length);
        input.queries.forEach((query, qi) => {
            const brute = input.rectangles
                .map((rect, ri) => (overlaps(rect, query) ? `rect-${ri}` : null))
                .filter((id) => id !== null);
            expect([...(results[qi] as string[])].sort()).toEqual(brute.sort());
        });
    });

    it("handles single and empty result queries", () => {
        const rectangles: Rect[] = [[0, 0, 2, 2], [5, 5, 7, 7]];
        const queries: Rect[] = [[0, 0, 2, 2], [20, 20, 30, 30]];
        const frames = [...mod.run({ rectangles, queries })];
        checkFrames(frames);
        const results = JSON.parse(frames[frames.length - 1]?.meta["resultsJson"] as string) as string[][];
        expect(results[0]).toEqual(["rect-0"]);
        expect(results[1]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
