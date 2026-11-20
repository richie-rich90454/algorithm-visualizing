/**
 * rwlock.test.ts - Mutual-exclusion property, blocked-writer progress, frame
 * shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./rwlock";
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

describe("Readers-Writer Lock", () => {
    it("never holds a writer and reader at the same time", () => {
        const input = mod.defaultInput as { threads: number; events: unknown[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.threads);
        for (const frame of frames) {
            const writer = frame.meta["writer"];
            const readers = frame.meta["readers"] as number[];
            if (writer !== null && writer !== undefined) {
                expect(readers.length).toBe(0);
            }
            expect(frame.meta["invariantHolds"]).toBe(true);
        }
    });

    it("blocks a writer behind readers and grants it after they leave", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        expect(frames[3]!.meta["writer"]).toBeNull();
        expect(frames[3]!.meta["waiting"]).toEqual([2]);
        expect(frames[5]!.meta["writer"]).toBe(2);
        const last = frames[frames.length - 1]!.meta;
        expect(Number(last["grants"])).toBeGreaterThanOrEqual(3);
        expect(last["waiting"]).toEqual([]);
    });

    it("allows concurrent readers", () => {
        const frames = [...mod.run({
            threads: 4,
            events: [
                { thread: 0, action: "acquire", type: "read" },
                { thread: 1, action: "acquire", type: "read" },
            ],
        })];
        checkFrames(frames, 4);
        expect(frames[2]!.meta["readers"]).toEqual([0, 1]);
        expect(frames[2]!.meta["writer"]).toBeNull();
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
