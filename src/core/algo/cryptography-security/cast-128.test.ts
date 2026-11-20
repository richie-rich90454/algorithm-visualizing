/**
 * cast-128.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cast-128";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("CAST-128 toy Feistel core", () => {
    it("decryption inverts encryption for many blocks, keys, and round counts", () => {
        for (let rounds of [1, 2, 5, 12, 16]) {
            for (let key = 0; key < 256; key += 37) {
                for (let a = 0; a < 256; a += 41) {
                    const b = (a * 7 + 13) & 0xff;
                    const frames = [...mod.run({ block: [a, b], key, rounds })];
                    checkFrames(frames);
                    const meta = frames[frames.length - 1]?.meta;
                    expect(meta?.["recovered"]).toEqual([a, b]);
                    expect(Array.isArray(meta?.["ciphertext"])).toBe(true);
                    expect((meta?.["ciphertext"] as number[]).length).toBe(2);
                }
            }
        }
    });

    it("changes the ciphertext when the key changes", () => {
        const a = [...mod.run({ block: [1, 2], key: 3, rounds: 8 })];
        const b = [...mod.run({ block: [1, 2], key: 4, rounds: 8 })];
        expect(a[a.length - 1]?.meta["ciphertext"]).not.toEqual(b[b.length - 1]?.meta["ciphertext"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
