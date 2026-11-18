/**
 * exactly-once-processing.test.ts - Deduplication, failure recovery, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./exactly-once-processing";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Array.isArray(frame.meta["sinkLog"])).toBe(true);
        expect(Number.isFinite(Number(frame.meta["checkpoint"]))).toBe(true);
    });
}

describe("ExactlyOnceProcessing", () => {
    it("writes each unique id exactly once despite duplicates", () => {
        const records = ["a", "b", "c", "b", "a", "d", "c"];
        const frames = [...mod.run({ records })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["exactlyOnce"]).toBe(true);
        expect(meta?.["sinkLog"]).toEqual(["a", "b", "c", "d"]);
        expect(Number(meta?.["committed"])).toBe(4);
        expect(Number(meta?.["duplicates"])).toBe(3);
        const log = meta?.["sinkLog"] as string[];
        expect(new Set(log).size).toBe(log.length);
    });

    it("checkpoint advances only on successful commits", () => {
        const frames = [...mod.run({ records: ["a", "b", "c"], failSinks: [2] })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        // Attempt 2 fails for "b", so c commits at record index 2 and checkpoint is 2.
        expect(Number(meta?.["checkpoint"])).toBe(2);
        expect(meta?.["sinkLog"]).toEqual(["a", "c"]);
        expect(meta?.["exactlyOnce"]).toBe(false);
    });

    it("retries a failed id when it is redelivered", () => {
        const records = ["a", "a", "b"];
        // First attempt (for the first "a") fails; the redelivered "a" retries and commits.
        const frames = [...mod.run({ records, failSinks: [1] })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["sinkLog"]).toEqual(["a", "b"]);
        expect(meta?.["exactlyOnce"]).toBe(true);
        expect(Number(meta?.["attempts"])).toBe(3);
    });

    it("matches a brute-force deduplication reference", () => {
        for (const records of [[1, 2, 1, 3, 2], ["x", "y", "z", "x"], [7, 7, 7]]) {
            const frames = [...mod.run({ records })];
            const meta = frames[frames.length - 1]?.meta;
            const unique = [...new Set<string | number>(records as Array<string | number>)].map(String);
            expect(meta?.["sinkLog"]).toEqual(unique);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
