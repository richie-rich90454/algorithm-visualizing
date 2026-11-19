/**
 * rc6.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { rc6Decrypt, rc6Encrypt, rc6EncryptTrace, rc6ExpandKey } from "./rc6";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rounds: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe((rounds + 1) * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(rounds + 1);
        expect(frame.meta["cols"]).toBe(4);
    });
}

/** Deterministic pseudo-random words to exercise many blocks. */
function pseudoWords(seed: number, count: number): [number, number, number, number][] {
    const blocks: [number, number, number, number][] = [];
    let s = seed >>> 0;
    for (let i = 0; i < count; i += 1) {
        const block = [] as number[];
        for (let j = 0; j < 4; j += 1) {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            block.push(s);
        }
        blocks.push(block as [number, number, number, number]);
    }
    return blocks;
}

describe("RC6 Block Cipher", () => {
    it("round-trips for many keys, plaintexts, and round counts", () => {
        const keys = [
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
            new Array<number>(16).fill(0),
            [255, 128, 64, 32, 16, 8, 4, 2, 1, 3, 7, 15, 31, 63, 127, 255],
        ];
        const blocks = pseudoWords(42, 12);
        for (const rounds of [1, 2, 4, 8, 12, 20]) {
            for (const key of keys) {
                for (const block of blocks) {
                    const cipher = rc6Encrypt(key, block, rounds);
                    expect(rc6Decrypt(key, cipher, rounds)).toEqual(block.map((w) => w >>> 0));
                }
            }
        }
    });

    it("is deterministic, key-sensitive, and avalanche-sensitive", () => {
        const key = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        const block: [number, number, number, number] = [1, 2, 3, 4];
        const a = rc6Encrypt(key, block, 12);
        expect(rc6Encrypt(key, block, 12)).toEqual(a);
        const changedKey = [...key];
        changedKey[0] = changedKey[0]! ^ 1;
        expect(rc6Encrypt(changedKey, block, 12)).not.toEqual(a);
        const changedBlock: [number, number, number, number] = [1, 2, 3, 5];
        expect(rc6Encrypt(key, changedBlock, 12)).not.toEqual(a);
    });

    it("produces a trace whose last state equals the ciphertext", () => {
        const input = mod.defaultInput as {
            key: number[]; plaintext: [number, number, number, number]; rounds: number;
        };
        const trace = rc6EncryptTrace(input.key, input.plaintext, input.rounds);
        expect(trace.length).toBe(input.rounds + 1);
        const cipher = rc6Encrypt(input.key, input.plaintext, input.rounds);
        const last = trace[trace.length - 1]!;
        expect([last.a, last.b, last.c, last.d]).toEqual(cipher);
        expect(rc6ExpandKey(input.key, input.rounds).length).toBe(2 * input.rounds + 4);
    });

    it("emits well-formed frames with a verified final round trip", () => {
        const input = mod.defaultInput as {
            key: number[]; plaintext: [number, number, number, number]; rounds: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.rounds);
        const finalMeta = frames[frames.length - 1]!.meta;
        expect(finalMeta["roundTrip"]).toBe(true);
        expect(finalMeta["restored"]).toEqual(input.plaintext.map((w) => w >>> 0));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
