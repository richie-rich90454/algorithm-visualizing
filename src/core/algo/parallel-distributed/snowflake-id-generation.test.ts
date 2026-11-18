/**
 * snowflake-id-generation.test.ts - Bit-field uniqueness, monotonicity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./snowflake-id-generation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBe(count + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SnowflakeIdGeneration", () => {
    it("packs ids whose decoded fields match the inputs", () => {
        const input = { workerId: 3, workerBits: 5, seqBits: 12, epoch: 1000, now: 2000, count: 4 };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.count);
        const meta = frames[frames.length - 1]?.meta;
        const ids = meta?.["ids"] as number[];
        const fields = JSON.parse(String(meta?.["fields"])) as Array<{ timestamp: number; worker: number; sequence: number }>;
        expect(ids.length).toBe(4);
        for (let i = 0; i < ids.length; i += 1) {
            expect(fields[i]?.worker).toBe(input.workerId);
            expect(fields[i]?.timestamp).toBe(input.now);
            expect(fields[i]?.sequence).toBe(i);
            expect(Number.isSafeInteger(ids[i])).toBe(true);
        }
    });

    it("produces strictly increasing ids within a worker", () => {
        for (const count of [1, 5, 16]) {
            const frames = [...mod.run({ workerId: 2, epoch: 0, now: 500, count })];
            checkFrames(frames, count);
            const meta = frames[frames.length - 1]?.meta;
            const ids = meta?.["ids"] as number[];
            expect(meta?.["increasing"]).toBe(true);
            for (let i = 1; i < ids.length; i += 1) {
                expect(ids[i]!).toBeGreaterThan(ids[i - 1]!);
            }
        }
    });

    it("keeps ids from different workers distinct", () => {
        const base = { workerBits: 5, seqBits: 12, epoch: 0, now: 100, count: 3 };
        const all = new Set<number>();
        for (let workerId = 0; workerId < 8; workerId += 1) {
            const frames = [...mod.run({ ...base, workerId })];
            const ids = frames[frames.length - 1]?.meta["ids"] as number[];
            for (const id of ids) {
                all.add(id);
            }
        }
        expect(all.size).toBe(8 * base.count);
    });

    it("rolls the sequence over when the counter fills", () => {
        const frames = [...mod.run({ workerId: 1, seqBits: 2, workerBits: 2, epoch: 0, now: 10, count: 6 })];
        const meta = frames[frames.length - 1]?.meta;
        const fields = JSON.parse(String(meta?.["fields"])) as Array<{ sequence: number; timestamp: number }>;
        // With four sequence values per millisecond, six ids span two milliseconds.
        expect(Number(meta?.["wraps"])).toBeGreaterThanOrEqual(1);
        expect(fields[4]?.timestamp).toBe(11);
        expect(fields[4]?.sequence).toBe(0);
        const ids = meta?.["ids"] as number[];
        for (let i = 1; i < ids.length; i += 1) {
            expect(ids[i]!).toBeGreaterThan(ids[i - 1]!);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
