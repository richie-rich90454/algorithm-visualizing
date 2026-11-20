/** cbc-mac.test.ts - Independent chain replay, tamper detection, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./cbc-mac";
import type { VisualFrame } from "@/types";

interface MacInput { blocks: number[]; key: number; }

function toyEncrypt(key: number, block: number): number {
    return (79 * (((block ^ (key & 0xff)) + 256) & 0xff) + 55) & 0xff;
}

function reference(blocks: number[], key: number) {
    let chain = 0;
    const states: number[] = [];
    for (const block of blocks) {
        chain = toyEncrypt(key, chain ^ block);
        states.push(chain);
    }
    return { tag: chain, states };
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

describe("CBC-MAC toy model", () => {
    it("matches an independent chain replay on the default input", () => {
        const input = mod.defaultInput as MacInput;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.blocks, input.key);
        expect(final?.["states"]).toEqual(expected.states);
        expect(final?.["tag"]).toBe(expected.tag);
    });

    it("the toy block function is a permutation of 0..255", () => {
        const image = new Set<number>();
        for (let x = 0; x < 256; x += 1) image.add(toyEncrypt(42, x));
        expect(image.size).toBe(256);
    });

    it("changes the tag when any block or the key changes", () => {
        const input = mod.defaultInput as MacInput;
        const baseTag = [...mod.run(input)].at(-1)?.meta["tag"];
        for (let i = 0; i < input.blocks.length; i += 1) {
            const changed = input.blocks.map((b, j) => (i === j ? b ^ 0xff : b));
            expect([...mod.run({ blocks: changed, key: input.key })].at(-1)?.meta["tag"]).not.toBe(baseTag);
        }
        expect([...mod.run({ blocks: input.blocks, key: input.key ^ 0x02 })].at(-1)?.meta["tag"]).not.toBe(baseTag);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
