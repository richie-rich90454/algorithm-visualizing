/**
 * fruitchains.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./fruitchains";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], blocks: number, slots: number): void {
    expect(frames.length).toBe(blocks + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(blocks * slots);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("FruitChains Fair Blockchain", () => {
    it("builds a valid chain containing every fruit exactly once", () => {
        const input = mod.defaultInput as { fruits: number; fruitsPerBlock: number };
        const frames = [...mod.run(input)];
        const blocks = Math.ceil(input.fruits / input.fruitsPerBlock);
        checkFrames(frames, blocks, input.fruitsPerBlock);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["valid"]).toBe(true);
        expect(last?.["blocks"]).toBe(blocks);
        const chain = last?.["chain"] as Array<{ height: number; fruits: number[]; parent: number | null }>;
        const collected = chain.flatMap((block) => block.fruits).sort((a, b) => a - b);
        const expected = Array.from({ length: input.fruits }, (_, index) => index);
        expect(collected).toEqual(expected);
    });

    it("links every block to its predecessor and never duplicates a fruit", () => {
        const input = { miners: 4, fruits: 20, fruitsPerBlock: 4, seed: 11 };
        const frames = [...mod.run(input)];
        const chain = frames[frames.length - 1]?.meta["chain"] as Array<{ height: number; parent: number | null; fruits: number[] }>;
        chain.forEach((block, index) => {
            expect(block.height).toBe(index);
            expect(block.parent).toBe(index === 0 ? null : index - 1);
            expect(block.fruits.length).toBeLessThanOrEqual(input.fruitsPerBlock);
        });
        const all = chain.flatMap((block) => block.fruits);
        expect(new Set(all).size).toBe(all.length);
    });

    it("is deterministic for a fixed seed", () => {
        const first = [...mod.run(mod.defaultInput)];
        const second = [...mod.run(mod.defaultInput)];
        expect(first[first.length - 1]?.meta["fruitMiners"]).toEqual(second[second.length - 1]?.meta["fruitMiners"]);
        expect(first[first.length - 1]?.meta["blockMiners"]).toEqual(second[second.length - 1]?.meta["blockMiners"]);
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
