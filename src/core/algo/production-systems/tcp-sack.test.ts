/** tcp-sack.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./tcp-sack";
import type { VisualFrame } from "@/types";

type Block = [number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function bruteForceHoles(total: number, cumulative: number, blocks: Block[]): number[] {
    const holes: number[] = [];
    for (let seq = 1; seq <= total; seq += 1) {
        const cum = seq <= cumulative;
        const sacked = blocks.some(([lo, hi]) => seq >= lo && seq <= hi);
        if (!cum && !sacked) holes.push(seq);
    }
    return holes;
}

describe("TCP SACK", () => {
    it("finds exactly the unacknowledged holes on the default input", () => {
        const input = mod.defaultInput as { total: number; cumulativeAck: number; sackBlocks: Block[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(last?.meta["retransmit"]).toEqual(bruteForceHoles(input.total, input.cumulativeAck, input.sackBlocks));
    });

    it("matches a brute-force scoreboard over random windows", () => {
        let seed = 4444;
        const rand = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let trial = 0; trial < 80; trial += 1) {
            const total = 1 + rand(20);
            const cumulative = rand(total + 1);
            const blocks: Block[] = [];
            const blockCount = rand(4);
            for (let i = 0; i < blockCount; i += 1) {
                const lo = 1 + rand(total);
                const hi = Math.min(total, lo + rand(4));
                blocks.push([lo, hi]);
            }
            const frames = [...mod.run({ total, cumulativeAck: cumulative, sackBlocks: blocks })];
            const last = frames[frames.length - 1];
            expect(last?.meta["retransmit"]).toEqual(bruteForceHoles(total, cumulative, blocks));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
