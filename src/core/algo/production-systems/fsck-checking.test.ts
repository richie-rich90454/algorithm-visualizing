/** fsck-checking.test.ts - Brute-force consistency check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./fsck-checking";
import type { VisualFrame } from "@/types";

interface Inode {
    id: number;
    blocks: number[];
    links: number;
}

function reference(totalBlocks: number, inodes: Inode[], free: number[]) {
    const counts = Array.from({ length: totalBlocks }, () => 0);
    const missing: number[] = [];
    for (const inode of inodes) {
        for (const b of inode.blocks) {
            if (b >= 0 && b < totalBlocks) counts[b] = (counts[b] ?? 0) + 1;
            else missing.push(b);
        }
    }
    const freeSet = new Set(free.filter((b) => b >= 0 && b < totalBlocks));
    const multiply: number[] = [];
    const orphan: number[] = [];
    const doubleFree: number[] = [];
    for (let b = 0; b < totalBlocks; b += 1) {
        const c = counts[b] ?? 0;
        if (c > 1) multiply.push(b);
        if (c === 0 && !freeSet.has(b)) orphan.push(b);
        if (c > 0 && freeSet.has(b)) doubleFree.push(b);
    }
    const freeAfterRepair = [...new Set([...freeSet, ...orphan])].sort((a, b) => a - b);
    return { counts, multiply, orphan, missing, doubleFree, freeAfterRepair };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("fsck-checking", () => {
    it("matches a brute-force tally on the default filesystem", () => {
        const input = mod.defaultInput as { totalBlocks: number; inodes: Inode[]; free: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.totalBlocks, input.inodes, input.free);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["refcounts"]).toEqual(expected.counts);
        expect(final?.["multiply"]).toEqual(expected.multiply);
        expect(final?.["orphan"]).toEqual(expected.orphan);
        expect(final?.["missing"]).toEqual(expected.missing);
        expect(final?.["doubleFree"]).toEqual(expected.doubleFree);
        expect(final?.["freeAfterRepair"]).toEqual(expected.freeAfterRepair);
        expect(final?.["problemCount"]).toBe(
            expected.multiply.length + expected.orphan.length + expected.missing.length + expected.doubleFree.length,
        );
    });

    it("reports a clean filesystem when every block is claimed or free", () => {
        const input = { totalBlocks: 5, inodes: [{ id: 1, blocks: [0, 1, 2], links: 1 }], free: [3, 4] };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["problemCount"]).toBe(0);
        expect(final?.["multiply"]).toEqual([]);
        expect(final?.["orphan"]).toEqual([]);
        expect(final?.["missing"]).toEqual([]);
    });

    it("detects a double-free block", () => {
        const input = { totalBlocks: 3, inodes: [{ id: 1, blocks: [0], links: 1 }], free: [0, 2] };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["doubleFree"]).toEqual([0]);
        expect(final?.["orphan"]).toEqual([1]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
