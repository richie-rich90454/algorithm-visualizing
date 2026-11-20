import { describe, expect, it } from "vitest";
import mod from "./leader-follower-replication";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Leader/Follower Replication", () => {
    it("commits every entry and copies the leader log to all replicas", () => {
        const input = mod.defaultInput as {
            followers: number;
            entries: number[];
            quorum: number;
            ackOrder: number[];
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["complete"]).toBe(true);
        expect(Number(final?.["commitIndex"])).toBe(input.entries.length);
        const logs = final?.["logs"] as number[][];
        expect(logs.length).toBe(input.followers + 1);
        for (const log of logs) {
            expect(log).toEqual(input.entries);
        }
    });

    it("respects quorum size when counting acknowledgments", () => {
        const input = { followers: 3, entries: [1, 2], quorum: 3, ackOrder: [1, 2, 3] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const commitFrames = frames.filter((f) => f.meta["acks"] !== undefined && Number(f.meta["acks"]) >= 2);
        expect(commitFrames.length).toBeGreaterThan(0);
        const quorumFrame = frames.find((f) => f.meta["entry"] === 1 && Number(f.meta["acks"]) === 3);
        expect(quorumFrame).toBeDefined();
        expect(Number(quorumFrame?.meta["commitIndex"])).toBe(1);
        expect((frames[frames.length - 1]?.meta["logs"] as number[][]).every((l) => l.length === 2)).toBe(true);
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
