/** sha1-hash.test.ts - Known-answer vectors, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./sha1-hash";
import type { VisualFrame } from "@/types";

function digestOf(message: string): string {
    const frames = [...mod.run({ message })];
    return String(frames[frames.length - 1]?.meta["digest"]);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SHA-1 Hash", () => {
    const vectors: Array<[string, string]> = [
        ["", "da39a3ee5e6b4b0d3255bfef95601890afd80709"],
        ["abc", "a9993e364706816aba3e25717850c26c9cd0d89d"],
        ["message digest", "c12252ceda8be8994d5fa0290a47231c1d16aae3"],
        ["abcdefghijklmnopqrstuvwxyz", "32d10c7b8cf96570ca04ce37f2a19d84240d3a89"],
    ];

    it("matches the FIPS 180 test vectors", () => {
        for (const [message, expected] of vectors) {
            expect(digestOf(message)).toBe(expected);
        }
    });

    it("changes the digest when one character changes", () => {
        expect(digestOf("abc")).not.toBe(digestOf("abd"));
    });

    it("has well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames.length).toBe(1 + 4 + 1);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });

    it("handles a message spanning multiple blocks", () => {
        const long = "The quick brown fox jumps over the lazy dog";
        expect(digestOf(long)).toBe("2fd4e1c67a2d28fced849ee1bb76e7391b93eb12");
        checkFrames([...mod.run({ message: long })]);
    });
});
