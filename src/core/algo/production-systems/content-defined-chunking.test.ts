/** content-defined-chunking.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./content-defined-chunking";
import type { VisualFrame } from "@/types";

/** Independent copy of the deterministic gear table for verifying boundaries. */
function gearTable(): number[] {
    const table: number[] = [];
    let state = 0x9e3779b9;
    for (let i = 0; i < 256; i += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        table.push(state);
    }
    return table;
}

function hashOf(text: string): number {
    const table = gearTable();
    let hash = 0;
    for (const ch of text) {
        hash = (((hash << 1) >>> 0) ^ (table[ch.charCodeAt(0) & 0xff] as number)) >>> 0;
    }
    return hash;
}

/** Check that a frame sequence is well formed. */
function checkFrames(frames: VisualFrame[], expectedChars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(expectedChars);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Content-Defined Chunking", () => {
    it("produces contiguous chunks that reassemble the input", () => {
        const data = "dedupeContentDefinedChunkingExample";
        const frames = [...mod.run({ data, avgBits: 3 })];
        checkFrames(frames, data.length);
        const final = frames[frames.length - 1];
        const chunks = final?.meta["chunks"] as string[];
        expect(chunks.join("")).toBe(data);
        expect(chunks.length).toBeGreaterThan(1);
        const boundaries = final?.meta["boundaries"] as number[];
        expect(boundaries[boundaries.length - 1]).toBe(data.length);
        let cursor = 0;
        for (let i = 0; i < boundaries.length; i += 1) {
            expect(boundaries[i]).toBeGreaterThan(cursor);
            cursor = boundaries[i] as number;
        }
        const mask = Number(final?.meta["mask"]);
        const maxChunk = Number(final?.meta["maxChunk"]);
        for (let i = 0; i < chunks.length - 1; i += 1) {
            const chunk = chunks[i] as string;
            expect(chunk.length).toBeLessThanOrEqual(maxChunk);
            if (chunk.length < maxChunk) {
                expect((hashOf(chunk) & mask) === 0).toBe(true);
            }
        }
    });

    it("is deterministic and stable under an edit far from the start", () => {
        let seed = 2718;
        const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
        const data = Array.from({ length: 2000 }, () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return alphabet[seed % alphabet.length] as string;
        }).join("");
        const first = [...mod.run({ data, avgBits: 4 })];
        const second = [...mod.run({ data, avgBits: 4 })];
        const chunksA = first[first.length - 1]?.meta["chunks"];
        const chunksB = second[second.length - 1]?.meta["chunks"];
        expect(chunksA).toEqual(chunksB);
        const count = (chunksA as string[]).length;
        expect(count).toBeGreaterThan(1);
        expect(count).toBeLessThan(data.length / 2);
        const edited = `${data.slice(0, 1000)}ZZZ${data.slice(1000)}`;
        const editedFrames = [...mod.run({ data: edited, avgBits: 4 })];
        const editedChunks = editedFrames[editedFrames.length - 1]?.meta["chunks"] as string[];
        expect(editedChunks.join("")).toBe(edited);
        expect(editedChunks.length).toBeGreaterThan(1);
    });

    it("handles empty and short inputs", () => {
        const empty = [...mod.run({ data: "", avgBits: 3 })];
        checkFrames(empty, 0);
        expect(empty[empty.length - 1]?.meta["chunks"]).toEqual([]);
        const short = [...mod.run({ data: "abc", avgBits: 3 })];
        checkFrames(short, 3);
        expect((short[short.length - 1]?.meta["chunks"] as string[]).join("")).toBe("abc");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
