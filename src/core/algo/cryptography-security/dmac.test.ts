/**
 * dmac.test.ts - Toy block-cipher bijection, independent DMAC reference,
 * message and key sensitivity, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { cbcMac, dmac, toyEncrypt } from "./dmac";
import type { VisualFrame } from "@/types";

function reference(message: string, k1: number, k2: number): number {
    const blocks = Array.from(message, (ch) => ch.charCodeAt(0) & 0xffff);
    const chain = (list: number[], key: number) => list.reduce((acc, block) => toyEncrypt(key, acc ^ block), 0);
    return chain([chain(blocks, k1), blocks.length & 0xffff], k2);
}

function checkFrames(frames: VisualFrame[], blockCount: number): void {
    expect(frames.length).toBe(blockCount + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(blockCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("DMAC Message Authentication Code", () => {
    it("uses a bijective toy block cipher for every key", () => {
        for (const key of [0, 1, 0x1234, 0xabcd, 0xffff]) {
            const seen = new Set<number>();
            for (let block = 0; block < 65536; block += 1) {
                seen.add(toyEncrypt(key, block));
            }
            expect(seen.size).toBe(65536);
        }
    });

    it("matches an independent DMAC reference on many messages", () => {
        const messages = ["", "A", "Hi", "authenticate me", "attack at dawn", "a much longer message for testing dmac"];
        for (const message of messages) {
            for (const [k1, k2] of [[0x1234, 0xabcd], [1, 2], [0, 0xffff]]) {
                expect(dmac(message, k1, k2)).toBe(reference(message, k1, k2));
            }
        }
    });

    it("changes the tag when the message or either key changes", () => {
        const base = dmac("hello", 0x1234, 0xabcd);
        expect(dmac("hellp", 0x1234, 0xabcd)).not.toBe(base);
        expect(dmac("hello!", 0x1234, 0xabcd)).not.toBe(base);
        expect(dmac("hello", 0x1235, 0xabcd)).not.toBe(base);
        expect(dmac("hello", 0x1234, 0xabce)).not.toBe(base);
    });

    it("chains blocks deterministically", () => {
        const blocks = [1, 2, 3, 4, 5];
        expect(cbcMac(blocks, 0x1234)).toBe(cbcMac(blocks, 0x1234));
        expect(cbcMac(blocks, 0x1234)).not.toBe(cbcMac(blocks, 0x1235));
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, "authenticate me".length);
        const final = frames[frames.length - 1]?.meta["tag"];
        expect(final).toBe(dmac("authenticate me", 0x1234, 0xabcd));
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
