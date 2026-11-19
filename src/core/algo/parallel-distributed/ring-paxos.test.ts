/**
 * ring-paxos.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./ring-paxos";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], replicas: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(replicas);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(replicas);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        for (const entity of frame.entities) {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        }
    });
}

describe("Ring Paxos", () => {
    it("commits every value exactly once with a quorum of votes", () => {
        const input = mod.defaultInput as { replicas: number; values: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.replicas);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["decided"]).toEqual(input.values);

        const quorum = Math.floor(input.replicas / 2) + 1;
        for (const frame of frames) {
            const votes = Number(frame.meta["votes"]);
            expect(votes).toBeGreaterThanOrEqual(0);
            expect(votes).toBeLessThanOrEqual(input.replicas);
            if (frame.meta["phase"] === "commit") {
                expect(votes).toBeGreaterThanOrEqual(quorum);
            }
        }
        const commits = frames.filter((frame) => frame.meta["phase"] === "commit");
        expect(commits.length).toBe(input.values.length);
    });

    it("visits replicas in ring order during a hop", () => {
        const frames = [...mod.run({ replicas: 4, values: [7] })];
        const holders = frames
            .filter((frame) => frame.meta["phase"] === "accept")
            .map((frame) => Number(frame.meta["holder"]));
        expect(holders).toEqual([1, 2, 3]);
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
