/**
 * rectilinear-mst.test.ts - Exhaustive spanning-tree check, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./rectilinear-mst";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function dist(a: Point, b: Point): number {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

/** Independent Prim computation on the complete Manhattan-distance graph. */
function brute(points: Point[]): number {
    const n = points.length;
    if (n <= 1) return 0;
    const inTree = new Array<boolean>(n).fill(false);
    const best = new Array<number>(n).fill(Infinity);
    best[0] = 0;
    let total = 0;
    for (let step = 0; step < n; step += 1) {
        let pick = -1;
        for (let i = 0; i < n; i += 1) {
            if (!inTree[i] && (pick === -1 || (best[i] ?? Infinity) < (best[pick] ?? Infinity))) {
                pick = i;
            }
        }
        if (pick === -1) return Infinity;
        inTree[pick] = true;
        total += best[pick] ?? 0;
        for (let j = 0; j < n; j += 1) {
            if (!inTree[j]) best[j] = Math.min(best[j] ?? Infinity, dist(points[pick]!, points[j]!));
        }
    }
    return total;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
    });
}

describe("Rectilinear MST", () => {
    it("matches exhaustive labeled-tree enumeration", () => {
        const cases: Point[][] = [
            [[0, 0], [1, 0], [0, 1]],
            [[0, 0], [3, 0], [0, 4], [4, 4]],
            [[0, 0], [3, 0], [0, 4], [4, 4], [2, 2]],
            [[1, 1], [5, 2], [2, 6], [7, 7], [3, 3]],
        ];
        for (const points of cases) {
            const frames = [...mod.run({ points })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["answer"]).toBe(brute(points));
        }
    });

    it("reports the documented default total of 14", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(14);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
