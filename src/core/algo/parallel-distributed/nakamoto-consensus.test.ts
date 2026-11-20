/**
 * nakamoto-consensus.test.ts - Brute-force heaviest-chain reference, reorg
 * handling, frame shape, and termination checks. Tests the longest-chain core.
 */

import { describe, expect, it } from "vitest";
import mod from "./nakamoto-consensus";
import type { VisualFrame } from "@/types";

interface Block { id: string; parent: string | null; work: number }

/** Enumerate every genesis-to-block path and return the heaviest tip and chain. */
function bruteForce(blocks: Block[]) {
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const paths = new Map<string, number>();
    for (const block of blocks) {
        const chain = [block.id];
        let cursor = block.parent;
        let work = block.work;
        while (cursor !== null && byId.has(cursor)) {
            chain.unshift(cursor);
            const parent = byId.get(cursor);
            work += parent?.work ?? 0;
            cursor = parent?.parent ?? null;
        }
        paths.set(block.id, work);
    }
    let tip = blocks[0]?.id ?? "";
    for (const block of blocks) {
        const w = paths.get(block.id) ?? 0;
        const best = paths.get(tip) ?? 0;
        if (w > best || (w === best && block.id < tip)) tip = block.id;
    }
    const chain = [tip];
    let cursor = byId.get(tip)?.parent ?? null;
    while (cursor !== null && byId.has(cursor)) {
        chain.unshift(cursor);
        cursor = byId.get(cursor)?.parent ?? null;
    }
    return { tip, chain, paths };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        frame.edges.forEach((edge) => {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
            expect(edge.directed).toBe(true);
        });
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("NakamotoConsensus", () => {
    it("selects the same heaviest chain as brute force on several trees", () => {
        const cases: Array<{ blocks: Block[]; previousTip: string }> = [
            {
                blocks: [
                    { id: "G", parent: null, work: 1 },
                    { id: "A", parent: "G", work: 1 },
                    { id: "B", parent: "A", work: 1 },
                    { id: "C", parent: "B", work: 1 },
                    { id: "X", parent: "A", work: 1 },
                    { id: "Y", parent: "X", work: 1 },
                    { id: "Z", parent: "Y", work: 1 },
                    { id: "W", parent: "Z", work: 1 },
                ],
                previousTip: "B",
            },
            {
                blocks: [
                    { id: "G", parent: null, work: 1 },
                    { id: "A", parent: "G", work: 2 },
                    { id: "B", parent: "A", work: 1 },
                    { id: "C", parent: "G", work: 3 },
                ],
                previousTip: "B",
            },
            {
                blocks: [
                    { id: "G", parent: null, work: 1 },
                    { id: "L", parent: "G", work: 1 },
                    { id: "R", parent: "G", work: 1 },
                ],
                previousTip: "L",
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.blocks.length);
            const expected = bruteForce(testCase.blocks);
            const final = frames[frames.length - 1];
            expect(final?.meta["tip"]).toBe(expected.tip);
            expect(final?.meta["chain"]).toEqual(expected.chain);
            const cumulative = JSON.parse(String(final?.meta["cumulative"])) as Record<string, number>;
            for (const [blockId, work] of expected.paths) {
                expect(Number(cumulative[blockId])).toBe(work);
            }
        }
    });

    it("reports a reorganization only when the previous tip lost", () => {
        const blocks = (mod.defaultInput as { blocks: Block[] }).blocks;
        const reorg = [...mod.run({ blocks, previousTip: "B" })];
        const noReorg = [...mod.run({ blocks, previousTip: "W" })];
        expect(reorg[reorg.length - 1]?.meta["reorg"]).toBe(true);
        expect(noReorg[noReorg.length - 1]?.meta["reorg"]).toBe(false);
        const none = [...mod.run({ blocks })];
        expect(none[none.length - 1]?.meta["reorg"]).toBe(false);
    });

    it("breaks cumulative-work ties by lexical identifier", () => {
        const blocks: Block[] = [
            { id: "G", parent: null, work: 1 },
            { id: "Z", parent: "G", work: 1 },
            { id: "A", parent: "G", work: 1 },
        ];
        const frames = [...mod.run({ blocks })];
        expect(frames[frames.length - 1]?.meta["tip"]).toBe("A");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
