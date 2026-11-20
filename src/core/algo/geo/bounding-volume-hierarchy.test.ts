/** bounding-volume-hierarchy.test.ts - Containment and partition properties, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./bounding-volume-hierarchy";
import type { VisualFrame } from "@/types";

type Pt = [number, number];
type Stored = {
    id: number;
    minX: number; minY: number; maxX: number; maxY: number;
    left: number | null; right: number | null; points: number[];
};

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(frame.edges.every((e) => ids.has(e.sourceId) && ids.has(e.targetId))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["structure"]).toBeDefined();
    });
}

describe("Bounding Volume Hierarchy", () => {
    it("encloses every point and partitions the input into leaves", () => {
        const points: Pt[] = [
            [1, 2], [2, 1], [3, 3], [4, 2], [5, 5],
            [6, 4], [7, 6], [8, 5], [2, 7], [9, 8], [0, 0], [5, 0],
        ];
        const leafSize = 2;
        const frames = [...mod.run({ points, leafSize })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const structure = final?.["structure"] as Stored[];
        const root = Number(final?.["root"]);
        const byId = new Map(structure.map((n) => [n.id, n]));
        expect(byId.size).toBe(structure.length);

        const subtreePoints = (id: number): number[] => {
            const node = byId.get(id);
            if (!node) throw new Error("dangling node");
            if (node.left === null && node.right === null) return node.points.slice();
            return [...(node.left === null ? [] : subtreePoints(node.left)), ...(node.right === null ? [] : subtreePoints(node.right))];
        };
        for (const node of structure) {
            const contained = subtreePoints(node.id);
            expect(contained.length).toBeGreaterThan(0);
            for (const index of contained) {
                const point = points[index] as Pt;
                expect(point[0]).toBeGreaterThanOrEqual(node.minX);
                expect(point[0]).toBeLessThanOrEqual(node.maxX);
                expect(point[1]).toBeGreaterThanOrEqual(node.minY);
                expect(point[1]).toBeLessThanOrEqual(node.maxY);
            }
            if (node.left === null && node.right === null) {
                expect(node.points.length).toBeLessThanOrEqual(leafSize);
            } else {
                expect(node.points.length).toBe(0);
            }
        }
        const leaves = structure.filter((n) => n.left === null && n.right === null);
        const allLeafPoints = leaves.flatMap((n) => n.points).sort((a, b) => a - b);
        expect(allLeafPoints).toEqual(points.map((_p, i) => i));
        expect(subtreePoints(root).slice().sort((a, b) => a - b)).toEqual(points.map((_p, i) => i));
    });

    it("handles duplicate points and a single point", () => {
        const duplicate = [...mod.run({ points: [[1, 1], [1, 1], [1, 1], [2, 2]], leafSize: 1 })];
        expect(duplicate[duplicate.length - 1]?.meta["pointCount"]).toBe(4);
        const single = [...mod.run({ points: [[3, 3]], leafSize: 2 })];
        expect(single[single.length - 1]?.meta["totalNodes"]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
