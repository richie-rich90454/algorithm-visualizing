/**
 * bloom-filter-blocked.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./bloom-filter-blocked";
import type { VisualFrame } from "@/types";

function hash(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

function positionsFor(item: string, numBlocks: number, bitsPerBlock: number, k: number) {
    const block = hash(item) % numBlocks;
    const h2 = hash(`${item}|salt`);
    const step = (h2 % (bitsPerBlock - 1)) + 1;
    const positions: number[] = [];
    for (let j = 0; j < k; j += 1) {
        positions.push((h2 + j * step) % bitsPerBlock);
    }
    return { block, positions };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Blocked Bloom Filter", () => {
    it("has no false negatives and consistent query results on the default input", () => {
        const input = mod.defaultInput as {
            items: string[];
            queries: string[];
            numBlocks: number;
            bitsPerBlock: number;
            k: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        const bits = finalMeta?.["bits"] as number[];
        expect(bits.length).toBe(input.numBlocks * input.bitsPerBlock);

        const results = finalMeta?.["results"] as number[];
        expect(results.length).toBe(input.queries.length);
        for (let i = 0; i < input.queries.length; i += 1) {
            const item = input.queries[i] as string;
            const { block, positions } = positionsFor(item, input.numBlocks, input.bitsPerBlock, input.k);
            const expected = positions.every((bit) => bits[block * input.bitsPerBlock + bit] === 1);
            expect(results[i]).toBe(expected ? 1 : 0);
            if (input.items.includes(item)) {
                expect(results[i]).toBe(1);
            }
        }
    });

    it("reports every inserted item as present on randomized inputs", () => {
        let seed = 23;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 30; t += 1) {
            const items = Array.from({ length: 1 + (rand() % 8) }, (_, i) => `item${i}-${rand() % 1000}`);
            const frames = [...mod.run({ items, queries: [...items], numBlocks: 4, bitsPerBlock: 16, k: 3 })];
            checkFrames(frames);
            const results = frames[frames.length - 1]?.meta["results"] as number[];
            expect(results.every((value) => value === 1)).toBe(true);
        }
    });

    it("keeps all probes inside a single block", () => {
        const frames = [...mod.run({ items: ["x", "y"], queries: [], numBlocks: 4, bitsPerBlock: 16, k: 3 })];
        checkFrames(frames);
        const insertFrames = frames.filter((f) => f.meta["phase"] === "insert");
        expect(insertFrames.length).toBe(2);
        for (const frame of insertFrames) {
            const block = frame.meta["block"] as number;
            const positions = frame.meta["positions"] as number[];
            expect(positions.every((p) => p >= 0 && p < 16)).toBe(true);
            expect(block).toBeGreaterThanOrEqual(0);
            expect(block).toBeLessThan(4);
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
