/**
 * selective-acknowledgment.test.ts - Brute-force scoreboard cross-check, gap
 * and retransmission properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { scoreboard } from "./selective-acknowledgment";
import type { VisualFrame } from "@/types";

/** Independent set-based reference for the scoreboard. */
function reference(total: number, cumulativeAck: number, blocks: Array<[number, number]>, limit: number) {
    const received = new Set<number>();
    for (let i = 1; i <= Math.min(total, cumulativeAck); i += 1) received.add(i);
    for (const [start, end] of blocks) {
        for (let i = Math.max(1, start); i <= Math.min(total, end); i += 1) received.add(i);
    }
    const highest = Math.max(0, ...[...received]);
    const holes: number[] = [];
    for (let i = cumulativeAck + 1; i <= highest; i += 1) {
        if (!received.has(i)) holes.push(i);
    }
    return { highest, holes, retransmit: holes.slice(0, limit) };
}

function checkFrames(frames: VisualFrame[], segmentCount: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(segmentCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("TCP Selective Acknowledgment Scoreboard", () => {
    it("matches an independent set-based reference on many inputs", () => {
        const cases = [
            { total: 10, cumulativeAck: 5, sackBlocks: [[6, 7], [9, 10]] as Array<[number, number]>, retransmitLimit: 3 },
            { total: 12, cumulativeAck: 2, sackBlocks: [[4, 4], [6, 8], [10, 12]] as Array<[number, number]>, retransmitLimit: 5 },
            { total: 8, cumulativeAck: 0, sackBlocks: [[5, 6]] as Array<[number, number]>, retransmitLimit: 2 },
            { total: 6, cumulativeAck: 6, sackBlocks: [] as Array<[number, number]>, retransmitLimit: 3 },
        ];
        for (const testCase of cases) {
            const got = scoreboard(testCase);
            const expected = reference(testCase.total, testCase.cumulativeAck, testCase.sackBlocks, testCase.retransmitLimit);
            expect(got.highest).toBe(expected.highest);
            expect(got.holes).toEqual(expected.holes);
            expect(got.retransmit).toEqual(expected.retransmit);
        }
    });

    it("reports no gaps when SACK blocks are contiguous with the cumulative ACK", () => {
        const result = scoreboard({ total: 10, cumulativeAck: 7, sackBlocks: [[8, 10]], retransmitLimit: 3 });
        expect(result.holes).toEqual([]);
        expect(result.retransmit).toEqual([]);
        expect(result.highest).toBe(10);
    });

    it("never retransmits beyond the gap list or the configured limit", () => {
        const result = scoreboard({
            total: 30,
            cumulativeAck: 1,
            sackBlocks: [[20, 30]],
            retransmitLimit: 4,
        });
        expect(result.retransmit.length).toBe(4);
        expect(result.retransmit.every((segment) => result.holes.includes(segment))).toBe(true);
        expect(result.holes.length).toBe(18);
    });

    it("does not mark segments outside the reported ranges", () => {
        const result = scoreboard({ total: 12, cumulativeAck: 3, sackBlocks: [[10, 12]], retransmitLimit: 3 });
        expect(result.received[3]).toBe(false);
        expect(result.received[8]).toBe(false);
        expect(result.received[9]).toBe(true);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 10);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
