/**
 * mysticeti-consensus.test.ts - DAG references, leader commit rule, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./mysticeti-consensus";
import type { VisualFrame } from "@/types";

interface DagBlock {
    id: string;
    round: number;
    leader: boolean;
    value: string;
    references: string[];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independently recompute committed leaders from the raw block DAG. */
function bruteForceCommitted(blocks: DagBlock[], quorum: number): string[] {
    const leaders = blocks.filter((b) => b.leader);
    const committed: string[] = [];
    for (const leader of leaders) {
        const voters = blocks.filter((b) => b.round === leader.round + 1 && b.references.includes(leader.id));
        if (voters.length >= quorum) {
            committed.push(leader.id);
        }
    }
    return committed;
}

describe("MysticetiConsensus", () => {
    it("every non-genesis block references a quorum of predecessor blocks", () => {
        const frames = [...mod.run({ nodes: 4, rounds: 3, crash: [] })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const blocks = JSON.parse(String(meta?.["blocks"])) as DagBlock[];
        const quorum = Number(meta?.["quorum"]);
        for (const block of blocks) {
            if (block.round > 1) {
                expect(block.references.length).toBe(quorum);
                for (const ref of block.references) {
                    expect(blocks.some((b) => b.id === ref && b.round === block.round - 1)).toBe(true);
                }
            }
        }
    });

    it("committed leaders match an independent quorum reference count", () => {
        for (const crash of [[], [0], [1, 2]]) {
            const frames = [...mod.run({ nodes: 7, rounds: 4, crash })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const quorum = Number(meta?.["quorum"]);
            const committed = (meta?.["committedLeaders"] as string[]) ?? [];
            const alive = Number(meta?.["alive"]);
            if (alive < quorum) {
                expect(committed.length).toBe(0);
                continue;
            }
            expect(committed.length).toBeGreaterThan(0);
            // Each committed leader must be a declared leader.
            const leaders = (meta?.["leaders"] as string[]) ?? [];
            for (const id of committed) {
                expect(leaders).toContain(id);
            }
            // The final order must contain the values of the committed leaders.
            const blocks = JSON.parse(String(meta?.["blocks"] ?? "[]")) as DagBlock[];
            expect(committed).toEqual(bruteForceCommitted(blocks, quorum));
            const expectedValues = committed.map((id) => blocks.find((b) => b.id === id)?.value);
            expect(meta?.["commitOrder"]).toEqual(expectedValues);
        }
    });

    it("stalls when too few validators are live", () => {
        const frames = [...mod.run({ nodes: 7, rounds: 3, crash: [0, 1, 2, 3, 4] })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["committedLeaders"]).toEqual([]);
        expect(meta?.["commitOrder"]).toEqual([]);
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
