/**
 * deflate-compression.test.ts - LZ77 round-trip, match and Huffman optimality checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./deflate-compression";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], textLength: number): void {
    expect(frames[0]).toBeDefined();
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(textLength);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
    });
}

/** Rebuild the text from the token arrays in meta, independent of module code. */
function replay(text: string, kinds: number[], lengths: number[], distances: number[]): string {
    let out = "";
    for (let i = 0; i < kinds.length; i += 1) {
        if (kinds[i] === 0) {
            out += text[tokenStart(kinds, lengths, i)] ?? "";
        } else {
            const start = tokenStart(kinds, lengths, i);
            const distance = distances[i]!;
            for (let k = 0; k < lengths[i]!; k += 1) {
                out += out[start - distance + k] ?? "";
            }
        }
    }
    return out;
}

function tokenStart(kinds: number[], lengths: number[], index: number): number {
    let position = 0;
    for (let i = 0; i < index; i += 1) {
        position += kinds[i] === 0 ? 1 : lengths[i]!;
    }
    return position;
}

/** Independently compute the optimal Huffman cost from symbol frequencies. */
function optimalCost(frequencies: number[]): number {
    if (frequencies.length <= 1) {
        return frequencies.reduce((a, b) => a + b, 0);
    }
    const heap = [...frequencies].sort((a, b) => a - b);
    let cost = 0;
    while (heap.length > 1) {
        const a = heap.shift()!;
        const b = heap.shift()!;
        const merged = a + b;
        cost += merged;
        let insert = heap.length;
        while (insert > 0 && (heap[insert - 1] ?? 0) > merged) {
            insert -= 1;
        }
        heap.splice(insert, 0, merged);
    }
    return cost;
}

describe("DEFLATE compression (small LZ77 + Huffman simulator)", () => {
    it("round-trips every test text exactly", () => {
        const texts = [
            "TOBEORNOTTOBEORTOBEORNOT",
            "aaaaaaaaaaaaaaaaaaaa",
            "abcabcabcabcabcabc",
            "the quick brown fox jumps over the lazy dog",
            "a",
        ];
        for (const text of texts) {
            const frames = [...mod.run({ text, window: 32, minMatch: 3 })];
            checkFrames(frames, text.length);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["roundTrip"]).toBe(text);
            const replayed = replay(
                text,
                meta?.["tokenKinds"] as number[],
                meta?.["tokenLengths"] as number[],
                meta?.["tokenDistances"] as number[],
            );
            expect(replayed).toBe(text);
        }
    });

    it("emits genuine longest matches and an optimal prefix cost", () => {
        const text = "TOBEORNOTTOBEORTOBEORNOT";
        const frames = [...mod.run({ text, window: 32, minMatch: 3 })];
        checkFrames(frames, text.length);
        const meta = frames[frames.length - 1]?.meta;
        const kinds = meta?.["tokenKinds"] as number[];
        const lengths = meta?.["tokenLengths"] as number[];
        const distances = meta?.["tokenDistances"] as number[];
        let position = 0;
        for (let i = 0; i < kinds.length; i += 1) {
            if (kinds[i] === 0) {
                expect(lengths[i]).toBe(1);
                expect(distances[i]).toBe(0);
                position += 1;
                continue;
            }
            const distance = distances[i]!;
            expect(distance).toBeGreaterThan(0);
            expect(distance).toBeLessThanOrEqual(32);
            // Brute force the true longest match at this position.
            let best = 0;
            const from = Math.max(0, position - 32);
            for (let j = from; j < position; j += 1) {
                let length = 0;
                while (length < 258 && position + length < text.length && text[j + length] === text[position + length]) {
                    length += 1;
                }
                best = Math.max(best, length);
            }
            expect(lengths[i]).toBe(best);
            expect(best).toBeGreaterThanOrEqual(3);
            position += lengths[i]!;
        }
        expect(position).toBe(text.length);

        const frequencies = meta?.["frequencies"] as number[];
        const codeLengths = meta?.["codeLengths"] as number[];
        expect(codeLengths.length).toBe(frequencies.length);
        const kraft = codeLengths.reduce((sum, length) => sum + 2 ** -length, 0);
        expect(kraft).toBeCloseTo(1, 10);
        const costFromLengths = codeLengths.reduce((sum, length, i) => sum + length * frequencies[i]!, 0);
        expect(costFromLengths).toBe(optimalCost(frequencies));
        expect(Number(meta?.["encodedBits"])).toBe(costFromLengths);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        const last = [...mod.run(mod.defaultInput)].pop();
        expect(last?.meta["tokenCount"]).toBe(Number(last?.meta["tokenKinds"] && (last?.meta["tokenKinds"] as number[]).length));
        expect(generator.next().done).toBe(true);
    });
});
