/** cheap-paxos.test.ts - Exhaustive failure-set property checks, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./cheap-paxos";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], codeLines: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(codeLines);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((entity) => entity.id));
        frame.edges.forEach((edge) => {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
        frame.entities.forEach((entity) => {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        });
    });
}

/** All subsets of [0..size) with at most maxSize members. */
function subsets(size: number, maxSize: number): number[][] {
    const result: number[][] = [[]];
    for (let mask = 1; mask < 1 << size; mask += 1) {
        const subset: number[] = [];
        for (let i = 0; i < size; i += 1) {
            if ((mask & (1 << i)) !== 0) {
                subset.push(i);
            }
        }
        if (subset.length <= maxSize) {
            result.push(subset);
        }
    }
    return result;
}

describe("Cheap Paxos", () => {
    it("decides one value and teaches all live learners for every allowed failure set", () => {
        for (const f of [1, 2]) {
            const total = 2 * (f + 1);
            const quorumSize = Math.floor((f + 1) / 2) + 1;
            for (const failures of subsets(total, f)) {
                const frames = [...mod.run({ faults: f, failures, value: "alpha" })];
                checkFrames(frames, mod.pseudocode?.length ?? 0);
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["decided"]).toBe("alpha");
                const liveAcceptors = Array.from({ length: f + 1 }, (_, i) => i).filter((i) => !failures.includes(i));
                const expectedPromotions = liveAcceptors.length >= quorumSize
                    ? 0
                    : quorumSize - liveAcceptors.length;
                expect((final?.["promoted"] as number[]).length).toBe(expectedPromotions);
                const promoted = final?.["promoted"] as number[];
                const expectedLearners = Array.from({ length: f + 1 }, (_, i) => f + 1 + i)
                    .filter((i) => !failures.includes(i) && !promoted.includes(i));
                expect(final?.["learned"]).toEqual(expectedLearners);
                expect((final?.["quorum"] as number[]).length).toBeGreaterThanOrEqual(quorumSize);
            }
        }
    });

    it("keeps a majority quorum and a single decided value", () => {
        const frames = [...mod.run({ faults: 1, failures: [0], value: "v" })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["promoted"]).toEqual([2]);
        expect(final?.["quorum"]).toEqual([1, 2]);
        expect(final?.["learned"]).toEqual([3]);
        const decidedFrames = frames.filter((frame) => frame.meta["decided"] !== "");
        expect(decidedFrames.every((frame) => frame.meta["decided"] === "v")).toBe(true);
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
