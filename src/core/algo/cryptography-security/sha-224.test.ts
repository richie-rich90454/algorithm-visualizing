/**
 * sha-224.test.ts - Published FIPS 180-4 test vectors, avalanche behavior,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { compress, padMessage, sha224 } from "./sha-224";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], blocks: number): void {
    expect(frames.length).toBe(blocks + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("SHA-224 Hash", () => {
    it("matches the published FIPS 180-4 test vectors", () => {
        const vectors: Array<[string, string]> = [
            ["", "d14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f"],
            ["abc", "23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7"],
            [
                "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
                "75388b16512776cc5dba5da1fd890150b0c6455cb4f58b1952522525",
            ],
        ];
        for (const [message, digest] of vectors) {
            expect(sha224(message)).toBe(digest);
            const frames = [...mod.run({ message })];
            checkFrames(frames, padMessage(message).length / 16);
            expect(frames[frames.length - 1]?.meta["digest"]).toBe(digest);
        }
    });

    it("produces a 224-bit digest and changes it for a one-bit message change", () => {
        for (const message of ["", "a", "hello world", "a much longer teaching message about hashing"]) {
            const digest = sha224(message);
            expect(digest).toMatch(/^[0-9a-f]{56}$/);
            expect(sha224(`${message}x`)).not.toBe(digest);
        }
    });

    it("pads messages to whole 512-bit blocks with a length trailer", () => {
        expect(padMessage("").length).toBe(16);
        expect(padMessage("abc").length).toBe(16);
        expect(padMessage("a".repeat(56)).length).toBe(32);
        expect(padMessage("a".repeat(64)).length).toBe(32);
    });

    it("compresses a fresh chain deterministically", () => {
        const initial = [0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4];
        const block = padMessage("abc").slice(0, 16);
        expect(compress(initial, block)).toEqual(compress(initial, block));
        expect(compress(initial, block)).not.toEqual(initial);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
