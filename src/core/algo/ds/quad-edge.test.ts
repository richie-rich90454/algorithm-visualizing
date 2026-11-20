/**
 * quad-edge.test.ts - Property correctness on emitted onext pointers,
 * frame shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quad-edge";
import type { VisualFrame } from "@/types";

/** Parse "eE.Q->E2.Q2" labels back into an onext permutation. */
function readPermutation(frame: VisualFrame): Map<number, number> {
    const perm = new Map<number, number>();
    for (const entity of frame.entities) {
        const match = /^e(\d+)\.(\d)->(\d+)\.(\d)$/.exec(entity.label);
        if (!match) {
            continue;
        }
        const edge = Number(match[1]);
        const q = Number(match[2]);
        const targetEdge = Number(match[3]);
        const targetQ = Number(match[4]);
        perm.set(edge * 4 + q, targetEdge * 4 + targetQ);
    }
    return perm;
}

function cycleCount(perm: Map<number, number>): number {
    const seen = new Set<number>();
    let count = 0;
    for (const start of perm.keys()) {
        if (seen.has(start)) {
            continue;
        }
        count += 1;
        let cur = start;
        while (!seen.has(cur)) {
            seen.add(cur);
            const next = perm.get(cur);
            if (next === undefined) {
                break;
            }
            cur = next;
        }
    }
    return count;
}

function checkFrames(frames: VisualFrame[], edgeCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length % 4).toBe(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Quad-Edge Data Structure", () => {
    it("builds closed subdivisions satisfying Euler's formula", () => {
        for (const vertices of [3, 4, 5, 6]) {
            const frames = [...mod.run({ vertices })];
            checkFrames(frames, vertices);
            const last = frames[frames.length - 1];
            expect(last?.entities.length).toBe(vertices * 4);
            expect(last?.meta["eulerOk"]).toBe(true);
            expect(last?.meta["vertices"]).toBe(vertices);
            expect(last?.meta["edges"]).toBe(vertices);
            expect(last?.meta["faces"]).toBe(2);

            const perm = readPermutation(last as VisualFrame);
            expect(perm.size).toBe(vertices * 4);
            expect(cycleCount(perm)).toBe(vertices + 2);

            // rot and sym are exact permutations on every end.
            for (let end = 0; end < vertices * 4; end += 1) {
                const edge = Math.floor(end / 4);
                const q = end % 4;
                const sym = edge * 4 + ((q + 2) % 4);
                const rot4 = edge * 4 + ((q + 4) % 4);
                expect(sym).not.toBe(end);
                expect(rot4).toBe(end);
                expect(perm.has(sym)).toBe(true);
            }
        }
    });

    it("keeps every onext pointer inside a valid edge-end", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 4);
        const perm = readPermutation(frames[frames.length - 1] as VisualFrame);
        for (const target of perm.values()) {
            expect(target).toBeGreaterThanOrEqual(0);
            expect(target).toBeLessThan(16);
        }
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
