/**
 * sha-256-compression.test.ts - Known-answer vectors, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sha-256-compression";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(66);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const words = frame.meta["words"] as string[];
        expect(words).toHaveLength(8);
        expect(words.every((word) => /^[0-9a-f]{8}$/.test(word))).toBe(true);
    });
}

describe("Sha256Compression", () => {
    it("matches published SHA-256 digests for short messages", () => {
        const vectors: Array<[string, string]> = [
            ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
            ["a", "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"],
            ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
            ["hello", "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"],
            [
                "The quick brown fox jumps over the lazy dog",
                "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
            ],
        ];
        for (const [message, expected] of vectors) {
            const frames = [...mod.run({ message })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["digest"]).toBe(expected);
        }
    });

    it("produces a different digest for every differing message", () => {
        const messages = ["a", "b", "c", "aa", "ab", "abc", "abd"];
        const digests = messages.map((message) => {
            const frames = [...mod.run({ message })];
            checkFrames(frames);
            return String(frames[frames.length - 1]?.meta["digest"]);
        });
        expect(new Set(digests).size).toBe(messages.length);
    });

    it("replays its own default input deterministically", () => {
        const a = [...mod.run(mod.defaultInput)];
        const b = [...mod.run(mod.defaultInput)];
        checkFrames(a);
        expect(a.map((frame) => frame.meta["words"])).toEqual(b.map((frame) => frame.meta["words"]));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(66);
        expect(generator.next().done).toBe(true);
    });
});
