/** md5.test.ts - Known-answer vectors, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./md5";
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

describe("MD5 Hash", () => {
    const vectors: Array<[string, string]> = [
        ["", "d41d8cd98f00b204e9800998ecf8427e"],
        ["abc", "900150983cd24fb0d6963f7d28e17f72"],
        ["message digest", "f96b697d7cb7938d525a2f31aaf161d0"],
        ["abcdefghijklmnopqrstuvwxyz", "c3fcd3d76192e4007dfb496cca67e13b"],
    ];

    it("matches the published RFC 1321 test vectors", () => {
        for (const [message, expected] of vectors) {
            expect(digestOf(message)).toBe(expected);
        }
    });

    it("uses a different digest for each message", () => {
        const seen = new Set(vectors.map(([message]) => digestOf(message)));
        expect(seen.size).toBe(vectors.length);
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

    it("handles a message spanning several blocks", () => {
        const long = "a".repeat(100);
        const digest = digestOf(long);
        expect(digest).toHaveLength(32);
        expect(digest).not.toBe(digestOf("a".repeat(99)));
        const frames = [...mod.run({ message: long })];
        checkFrames(frames);
        expect(frames.length).toBe(1 + 2 * 4 + 1);
    });
});
