/** sha-512.test.ts - Known-answer vectors, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./sha-512";
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

describe("SHA-512 Hash", () => {
    const vectors: Array<[string, string]> = [
        [
            "",
            "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce" +
                "47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
        ],
        [
            "abc",
            "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a" +
                "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
        ],
        [
            "message digest",
            "107dbf389d9e9f71a3a95f6c055b9251bc5268c2be16d6c13492ea45b0199f3" +
                "309e16455ab1e96118e8a905d5597b72038ddb372a89826046de66687bb420e7c",
        ],
    ];

    it("matches the FIPS 180-4 test vectors", () => {
        for (const [message, expected] of vectors) {
            expect(digestOf(message)).toBe(expected);
        }
    });

    it("produces a 128-character hexadecimal digest", () => {
        expect(digestOf("abc")).toHaveLength(128);
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

    it("handles a message spanning several blocks", () => {
        const long = "The quick brown fox jumps over the lazy dog";
        expect(digestOf(long)).toBe(
            "07e547d9586f6a73f73fbac0435ed76951218fb7d0c8d788a309d785436bbb642" +
                "e93a252a954f23912547d1e8a3b5ed6e1bfd7097821233fa0538f3db854fee6",
        );
    });
});
