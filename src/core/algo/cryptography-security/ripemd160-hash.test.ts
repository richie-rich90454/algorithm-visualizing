/** ripemd160-hash.test.ts - Known-answer vectors, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./ripemd160-hash";
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

describe("RIPEMD-160 Hash", () => {
    const vectors: Array<[string, string]> = [
        ["", "9c1185a5c5e9fc54612808977ee8f548b2258d31"],
        ["abc", "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc"],
        ["message digest", "5d0689ef49d2fae572b881b123a85ffa21595f36"],
        ["abcdefghijklmnopqrstuvwxyz", "f71c27109c692c1b56bbdceb5b9d2865b3708dbc"],
    ];

    it("matches the reference RIPEMD-160 test vectors", () => {
        for (const [message, expected] of vectors) {
            expect(digestOf(message)).toBe(expected);
        }
    });

    it("produces a 40-character hexadecimal digest", () => {
        expect(digestOf("abc")).toHaveLength(40);
        expect(digestOf("abc")).not.toBe(digestOf("abd"));
    });

    it("has well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames.length).toBe(1 + 5 + 1);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
