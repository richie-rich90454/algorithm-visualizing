/**
 * raft-consensus.test.ts - Majority/quorum reference, crash handling, frame
 * shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./raft-consensus";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("RaftConsensus", () => {
    it("elects a leader and commits whenever a majority is alive", () => {
        for (const n of [3, 5, 7]) {
            for (const crash of [-1, 0, 1]) {
                const frames = [...mod.run({ nodes: n, crash, entry: "v=7" })];
                checkFrames(frames, n);
                const final = frames[frames.length - 1]?.meta;
                const quorum = Math.floor(n / 2) + 1;
                const alive = n - (crash >= 0 ? 1 : 0);
                expect(final?.["quorum"]).toBe(quorum);
                expect(quorum).toBeGreaterThan(n / 2);
                if (alive >= quorum) {
                    expect(final?.["leader"]).not.toBe(-1);
                    expect(Number(final?.["votes"])).toBeGreaterThanOrEqual(quorum);
                    expect(final?.["committed"]).toBe(true);
                    expect(final?.["commitIndex"]).toBe(1);
                    expect(final?.["entry"]).toBe("v=7");
                } else {
                    expect(final?.["leader"]).toBe(-1);
                    expect(final?.["committed"]).toBe(false);
                }
            }
        }
    });

    it("still elects a leader when the crashed node was the first candidate", () => {
        for (const n of [3, 5]) {
            const frames = [...mod.run({ nodes: n, crash: 0 })];
            checkFrames(frames, n);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["leader"]).toBe(1);
            expect(final?.["committed"]).toBe(true);
        }
    });

    it("reports monotonically growing votes before the leader appears", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 5);
        let last = 0;
        for (const frame of frames) {
            const votes = Number(frame.meta["votes"]);
            expect(votes).toBeGreaterThanOrEqual(last);
            expect(votes).toBeLessThanOrEqual(5);
            last = votes;
        }
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
