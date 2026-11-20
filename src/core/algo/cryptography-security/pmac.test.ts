/** pmac.test.ts - Independent tag replay, order independence, tamper detection, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./pmac";
import type { VisualFrame } from "@/types";

interface PmacInput { blocks: number[]; key: number; }

function toyEncrypt(key: number, block: number): number {
    return (79 * (((block ^ (key & 0xff)) + 256) & 0xff) + 55) & 0xff;
}
function gfDouble(v: number): number {
    const high = v & 0x80;
    const shifted = (v << 1) & 0xff;
    return high ? shifted ^ 0x1b : shifted;
}
function gfMultiply(a: number, b: number): number {
    let result = 0;
    let x = a & 0xff;
    let y = b & 0xff;
    while (y > 0) {
        if (y & 1) result ^= x;
        x = gfDouble(x);
        y >>>= 1;
    }
    return result & 0xff;
}
function gray(i: number): number { return (i ^ (i >>> 1)) & 0xff; }

function reference(blocks: number[], key: number) {
    const offset = toyEncrypt(key, 0);
    let accumulator = 0;
    blocks.forEach((block, i) => {
        accumulator ^= toyEncrypt(key, block ^ gfMultiply(offset, gray(i + 1)));
    });
    const tag = toyEncrypt(key, accumulator ^ toyEncrypt(key, blocks.length));
    return { offset, accumulator, tag };
}

/** Compute the tag with the per-block values accumulated in reverse order. */
function reverseTag(blocks: number[], key: number): number {
    const offset = toyEncrypt(key, 0);
    let accumulator = 0;
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
        accumulator ^= toyEncrypt(key, (blocks[i] ?? 0) ^ gfMultiply(offset, gray(i + 1)));
    }
    return toyEncrypt(key, accumulator ^ toyEncrypt(key, blocks.length));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("PMAC toy model", () => {
    it("matches an independent tag replay on the default input", () => {
        const input = mod.defaultInput as PmacInput;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.blocks, input.key);
        expect(final?.["offset"]).toBe(expected.offset);
        expect(final?.["accumulator"]).toBe(expected.accumulator);
        expect(final?.["tag"]).toBe(expected.tag);
    });

    it("produces the same tag when blocks are processed in reverse order", () => {
        const input = mod.defaultInput as PmacInput;
        const tag = [...mod.run(input)].at(-1)?.meta["tag"];
        expect(reverseTag(input.blocks, input.key)).toBe(tag);
        for (let trial = 0; trial < 20; trial += 1) {
            const blocks = Array.from({ length: 1 + (trial % 6) }, (_, i) => (trial * 17 + i * 31) % 256);
            expect(reverseTag(blocks, trial + 1)).toBe(reference(blocks, trial + 1).tag);
        }
    });

    it("changes the tag when any block changes", () => {
        const input = mod.defaultInput as PmacInput;
        const tag = [...mod.run(input)].at(-1)?.meta["tag"];
        for (let i = 0; i < input.blocks.length; i += 1) {
            const changed = input.blocks.map((b, j) => (i === j ? b ^ 0x80 : b));
            expect([...mod.run({ blocks: changed, key: input.key })].at(-1)?.meta["tag"]).not.toBe(tag);
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
