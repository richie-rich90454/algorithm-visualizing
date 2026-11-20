/**
 * des-block-cipher.test.ts - Exhaustive round-trip and bijection checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { feistelDecrypt, feistelEncrypt, feistelF, roundKeys } from "./des-block-cipher";
import type { VisualFrame } from "@/types";

type Input = { block: number; key: number };

/** Independent Feistel reference written directly from the round equations. */
function referenceEncrypt(block: number, key: number): number {
    const rot = (v: number): number => ((v << 1) | (v >>> 3)) & 0xf;
    let L = (block >>> 4) & 0xf;
    let R = block & 0xf;
    for (let i = 0; i < 4; i += 1) {
        const k = ((((key << i) | (key >>> (8 - i))) & 0xff) & 0xf);
        const nextL = R;
        const nextR = L ^ rot((R ^ k) & 0xf);
        L = nextL;
        R = nextR;
    }
    return ((L << 4) | R) & 0xff;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("DES-structure toy Feistel cipher", () => {
    it("round-trips every block under every key", () => {
        for (let key = 0; key < 256; key += 1) {
            for (let block = 0; block < 256; block += 1) {
                const cipher = feistelEncrypt(block, key);
                expect(feistelDecrypt(cipher, key)).toBe(block);
            }
        }
    });

    it("is a bijection for every key and matches an independent reference", () => {
        for (let key = 0; key < 256; key += 1) {
            const seen = new Set<number>();
            for (let block = 0; block < 256; block += 1) {
                seen.add(feistelEncrypt(block, key));
            }
            expect(seen.size).toBe(256);
        }
        const vectors: Array<[number, number]> = [[0x5a, 0x2d], [0, 0], [0xff, 0xa5], [0x13, 0x7e]];
        for (const [block, key] of vectors) {
            expect(feistelEncrypt(block, key)).toBe(referenceEncrypt(block, key));
        }
        expect(feistelF(0xa, 0x3)).toBe(0x3);
        expect(roundKeys(0x2d)).toHaveLength(4);
    });

    it("reports the round-trip in the final frame", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta ?? {};
        expect(final["roundTrip"]).toBe(true);
        expect(Number(final["recovered"])).toBe(input.block);
        expect(String(final["cipher"])).toBe(referenceEncrypt(input.block, input.key).toString(2).padStart(8, "0"));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
