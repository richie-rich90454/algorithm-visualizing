/**
 * huffman-coding.test.ts – Minimum viable test for Huffman Coding.
 */

import { describe, expect, it } from "vitest";
import huffmanCoding from "./huffman-coding";

describe("HuffmanCoding", () => {
    it("yields at least one frame", () => {
        const generator = huffmanCoding.run(huffmanCoding.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = huffmanCoding.run(huffmanCoding.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
