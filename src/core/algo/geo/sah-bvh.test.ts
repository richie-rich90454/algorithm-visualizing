/** sah-bvh.test.ts - BVH query correctness, frames, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./sah-bvh";
import type { VisualFrame } from "@/types";

type Box = [number, number, number, number];

function checkFrames(frames: VisualFrame[], nBoxes: number, steps: number): void {
    expect(frames.length).toBe(steps + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(nBoxes);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function bruteForce(boxes: Box[], point: number[]): number[] {
    return boxes
        .map((b, i) => ({ b, i }))
        .filter(({ b }) => b[0]! <= point[0]! && point[0]! <= b[2]! && b[1]! <= point[1]! && point[1]! <= b[3]!)
        .map(({ i }) => i);
}

describe("Surface-area-heuristic BVH", () => {
    it("answers queries identically to brute force on the default scene", () => {
        const input = mod.defaultInput as { boxes: Box[]; query: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.boxes.length, frames.length - 2);
        const final = frames[frames.length - 1]!.meta;
        expect(final["match"]).toBe(true);
        expect(final["hits"]).toEqual(bruteForce(input.boxes, input.query));
        const leaves = final["leaves"] as number[][];
        expect(leaves.flat().sort((a: number, b: number) => a - b)).toEqual(input.boxes.map((_, i) => i));
    });

    it("partitions primitives exactly once and prunes correctly on random scenes", () => {
        for (let seed = 1; seed <= 30; seed += 1) {
            let s = seed;
            const rand = (): number => {
                s = (s * 1103515245 + 12345) & 0x7fffffff;
                return s % 12;
            };
            const boxes: Box[] = [];
            for (let i = 0; i < 10; i += 1) {
                const x = rand();
                const y = rand();
                boxes.push([x, y, x + rand() + 1, y + rand() + 1]);
            }
            const query = [rand(), rand()];
            const frames = [...mod.run({ boxes, query, bins: 4, maxDepth: 4 })];
            checkFrames(frames, boxes.length, frames.length - 2);
            const final = frames[frames.length - 1]!.meta;
            expect(final["match"]).toBe(true);
            expect([...(final["hits"] as number[])].sort((a, b) => a - b)).toEqual(bruteForce(boxes, query));
            const leaves = final["leaves"] as number[][];
            expect(leaves.flat().sort((a: number, b: number) => a - b)).toEqual(boxes.map((_, i) => i));
        }
    });

    it("keeps internal split costs at or below the leaf cost", () => {
        const frames = [...mod.run(mod.defaultInput)];
        frames.slice(1, -1).forEach((frame) => {
            if (frame.meta["isLeaf"] === false) {
                expect(Number(frame.meta["bestCost"])).toBeLessThan(Number(frame.meta["leafCost"]));
            }
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
