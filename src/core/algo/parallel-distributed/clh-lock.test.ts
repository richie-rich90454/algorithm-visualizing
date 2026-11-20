/**
 * clh-lock.test.ts - Mutual exclusion, FIFO handoff, predecessor flag, frame
 * shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./clh-lock";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], threads: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(threads);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("CLH Queue Lock", () => {
    it("grants the lock to exactly one thread at a time", () => {
        const input = mod.defaultInput as { threads: number; events: unknown[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.threads);
        for (const frame of frames) {
            const holding = frame.entities.filter((e) => e.metadata["state"] === "holding");
            expect(holding.length).toBeLessThanOrEqual(1);
            expect(frame.meta["invariantHolds"]).toBe(true);
        }
    });

    it("hands off to successors in arrival order", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        expect(frames[1]!.meta["holder"]).toBe(0);
        expect(frames[2]!.meta["queue"]).toEqual([1]);
        expect(frames[3]!.meta["queue"]).toEqual([1, 2]);
        expect(frames[4]!.meta["holder"]).toBe(1);
        expect(frames[5]!.meta["holder"]).toBe(2);
        expect(frames[6]!.meta["holder"]).toBeNull();
    });

    it("clears the predecessor flag on release", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        const before = frames[3]!.meta["lockedFlags"] as boolean[];
        const after = frames[4]!.meta["lockedFlags"] as boolean[];
        expect(before[0]).toBe(true);
        expect(after[0]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
