/**
 * chord-dht.test.ts - Brute-force ownership check, finger-table check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { buildChord, directSuccessor, findSuccessorChord } from "./chord-dht";
import type { VisualFrame } from "@/types";

function clockwise(a: number, b: number, mod: number): number {
    return (b - a + mod) % mod;
}

/** Slow but obvious reference for the owner of each key on a ring. */
function bruteForceOwner(nodeIds: number[], key: number, mod: number): number {
    let best = nodeIds[0]!;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const node of nodeIds) {
        const distance = clockwise(key, node, mod);
        const adjusted = key === node ? 0 : distance === 0 ? mod : distance;
        if (adjusted < bestDistance) {
            bestDistance = adjusted;
            best = node;
        }
    }
    return best;
}

function checkFrames(frames: VisualFrame[], nodeCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodeCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Chord DHT", () => {
    it("agrees with brute force on every key for several random rings", () => {
        let seed = 12;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed;
        };
        for (let trial = 0; trial < 20; trial += 1) {
            const m = 4;
            const mod = 2 ** m;
            const nodeIds: number[] = [];
            while (nodeIds.length < 4) {
                const id = rand() % mod;
                if (!nodeIds.includes(id)) nodeIds.push(id);
            }
            const state = buildChord(nodeIds, m);
            for (let key = 0; key < mod; key += 1) {
                const expected = bruteForceOwner(nodeIds, key, mod);
                expect(directSuccessor(nodeIds, key, mod)).toBe(expected);
                for (const start of nodeIds) {
                    const lookup = findSuccessorChord(state, start, key);
                    expect(lookup.target).toBe(expected);
                    expect(lookup.path[0]).toBe(start);
                    expect(lookup.hops).toBe(lookup.path.length - 1);
                }
            }
        }
    });

    it("computes finger tables by the successor definition", () => {
        const nodeIds = [1, 4, 9, 12];
        const m = 4;
        const state = buildChord(nodeIds, m);
        for (const node of nodeIds) {
            const table = state.fingers.get(node)!;
            expect(table.length).toBe(m);
            for (let i = 0; i < m; i += 1) {
                expect(table[i]).toBe(directSuccessor(nodeIds, (node + 2 ** i) % 16, 16));
            }
        }
    });

    it("produces well-formed frames on the default input", () => {
        const input = mod.defaultInput as { m: number; nodes: number[]; key: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.nodes.length);
        const state = buildChord(input.nodes, input.m);
        const lookup = findSuccessorChord(state, input.nodes[0]!, input.key);
        expect(frames[frames.length - 1]?.meta["target"]).toBe(lookup.target);
        expect(frames[frames.length - 1]?.meta["hops"]).toBe(lookup.hops);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
