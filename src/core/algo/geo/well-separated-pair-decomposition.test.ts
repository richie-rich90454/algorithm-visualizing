/** well-separated-pair-decomposition.test.ts - Separation property, coverage, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./well-separated-pair-decomposition";
import type { VisualFrame } from "@/types";

type Point = [number, number];

type EncodedPair = { a: number[]; b: number[]; separated: boolean };

function boxOf(points: Point[], indices: number[]) {
    return {
        x1: Math.min(...indices.map((i) => points[i][0])),
        y1: Math.min(...indices.map((i) => points[i][1])),
        x2: Math.max(...indices.map((i) => points[i][0])),
        y2: Math.max(...indices.map((i) => points[i][1])),
    };
}

function distance(a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>): number {
    const dx = Math.max(0, a.x1 - b.x2, b.x1 - a.x2);
    const dy = Math.max(0, a.y1 - b.y2, b.y1 - a.y2);
    return Math.hypot(dx, dy);
}
function diameter(b: ReturnType<typeof boxOf>): number {
    return Math.max(b.x2 - b.x1, b.y2 - b.y1);
}

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

describe("Well-Separated Pair Decomposition", () => {
    it("emits only well-separated subset pairs", () => {
        const input = mod.defaultInput as { points: Point[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const pairs = JSON.parse(frames[frames.length - 1]?.meta["pairsJson"] as string) as EncodedPair[];
        expect(pairs.length).toBeGreaterThan(0);
        for (const pair of pairs) {
            expect(pair.a.length).toBeGreaterThan(0);
            expect(pair.b.length).toBeGreaterThan(0);
            const boxA = boxOf(input.points, pair.a);
            const boxB = boxOf(input.points, pair.b);
            expect(Math.max(diameter(boxA), diameter(boxB))).toBeLessThanOrEqual(distance(boxA, boxB) + 1e-9);
        }
    });

    it("represents every distinct point pair in some subset pair", () => {
        const input = mod.defaultInput as { points: Point[] };
        const frames = [...mod.run(input)];
        const pairs = JSON.parse(frames[frames.length - 1]?.meta["pairsJson"] as string) as EncodedPair[];
        const n = input.points.length;
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                const covered = pairs.some(
                    (p) => (p.a.includes(i) && p.b.includes(j)) || (p.b.includes(i) && p.a.includes(j)),
                );
                expect(covered).toBe(true);
            }
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
