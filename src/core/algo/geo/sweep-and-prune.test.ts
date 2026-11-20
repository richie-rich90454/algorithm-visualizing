/** sweep-and-prune.test.ts - Brute-force pair cross-check, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./sweep-and-prune";
import type { VisualFrame } from "@/types";

type Box = [number, number, number, number];

function brutePairs(boxes: Box[]): string[] {
    const result: string[] = [];
    for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
            const a = boxes[i] as Box;
            const b = boxes[j] as Box;
            if (a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]) result.push(`${i}-${j}`);
        }
    }
    return result.sort();
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(frame.edges.every((e) => ids.has(e.sourceId) && ids.has(e.targetId))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["pairs"]).toBeDefined();
    });
}

describe("Sweep and Prune", () => {
    it("finds exactly the overlapping pairs on random boxes", () => {
        let seed = 17;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % 20;
        };
        for (let t = 0; t < 25; t += 1) {
            const boxes: Box[] = Array.from({ length: 2 + (t % 8) }, () => {
                const x = rand();
                const y = rand();
                return [x, y, x + 1 + (rand() % 5), y + 1 + (rand() % 5)] as Box;
            });
            const frames = [...mod.run({ boxes })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect((final?.["pairs"] as string[]).slice().sort()).toEqual(brutePairs(boxes));
            expect(final?.["count"]).toBe(brutePairs(boxes).length);
        }
    });

    it("handles no overlaps and identical boxes", () => {
        const disjoint: Box[] = [[0, 0, 1, 1], [3, 3, 4, 4], [6, 0, 7, 1]];
        const empty = [...mod.run({ boxes: disjoint })];
        expect(empty[empty.length - 1]?.meta["pairs"]).toEqual([]);
        const same: Box[] = [[1, 1, 3, 3], [1, 1, 3, 3]];
        const overlap = [...mod.run({ boxes: same })];
        expect(overlap[overlap.length - 1]?.meta["pairs"]).toEqual(["0-1"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
