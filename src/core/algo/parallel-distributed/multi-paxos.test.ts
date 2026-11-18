/**
 * multi-paxos.test.ts - Majority-rule property checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateMultiPaxos } from "./multi-paxos";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], acceptors: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(acceptors + 1);
        expect(frame.edges.length).toBe(acceptors);
        expect(frame.edges.every((e) => e.directed && e.sourceId === "leader")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Multi-Paxos", () => {
    it("matches an independent majority computation across all acceptor counts and failure sets", () => {
        const proposals = [7, 3, 9];
        for (let acceptors = 1; acceptors <= 6; acceptors += 1) {
            for (let mask = 0; mask < 1 << acceptors; mask += 1) {
                const failed = Array.from({ length: acceptors }, (_, i) => i).filter((i) => (mask >> i) & 1);
                const quorum = Math.floor(acceptors / 2) + 1;
                const live = acceptors - failed.length;
                const expectedChosen = proposals.filter(() => live >= quorum);
                const data = simulateMultiPaxos(acceptors, proposals, failed);
                expect(data.quorum).toBe(quorum);
                expect(data.chosenValues).toEqual(expectedChosen);
                const frames = [...mod.run({ acceptors, proposals, failed })];
                checkFrames(frames, acceptors);
                expect(frames[frames.length - 1]?.meta["chosenValues"]).toEqual(expectedChosen);
            }
        }
    });

    it("never chooses a slot when a majority of acceptors fails", () => {
        for (const [acceptors, failed] of [
            [5, [0, 1, 2]] as const,
            [4, [0, 1]] as const,
            [3, [0, 1]] as const,
        ]) {
            const frames = [...mod.run({ acceptors, proposals: [1, 2], failed: [...failed] })];
            checkFrames(frames, acceptors);
            expect(frames[frames.length - 1]?.meta["chosenValues"]).toEqual([]);
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
