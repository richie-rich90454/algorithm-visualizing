/**
 * signal-protocol.test.ts - Ratchet chain, XOR round trip, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./signal-protocol";
import type { VisualFrame } from "@/types";

function hash32(value: number): number {
    let h = value >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return (h ^ (h >>> 16)) >>> 0;
}

function kdf(key: number, label: number): number {
    return hash32((key ^ Math.imul(label, 0x9e3779b1)) >>> 0);
}

function referenceChain(chainKey: number, count: number): { chain: number[]; keys: number[] } {
    let chain = chainKey >>> 0;
    const chainStates: number[] = [];
    const keys: number[] = [];
    for (let i = 0; i < count; i += 1) {
        chainStates.push(chain);
        keys.push(kdf(chain, 2));
        chain = kdf(chain, 1);
    }
    return { chain: chainStates, keys };
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * count);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("SignalProtocol", () => {
    it("derives the same chain and message keys as an independent KDF", () => {
        const input = { chainKey: 12345, messages: 5, deliver: [0, 1, 3, 2, 4] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.messages);
        const expected = referenceChain(input.chainKey, input.messages);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["messageKeys"]).toEqual(expected.keys);
        const chainCells = frames[1]!.entities
            .filter((e) => e.metadata["row"] === 1)
            .map((e) => Number(e.value));
        expect(chainCells).toEqual(expected.chain);
    });

    it("round trips plaintext through XOR with the message keys", () => {
        const plain = [100, 200, 300, 400, 500];
        const input = { chainKey: 99, messages: 5, plain, deliver: [0, 1, 2, 3, 4] };
        const frames = [...mod.run(input)];
        checkFrames(frames, 5);
        const meta = frames[frames.length - 1]?.meta;
        const keys = meta?.["messageKeys"] as number[];
        const ciphertext = meta?.["ciphertext"] as number[];
        for (let i = 0; i < plain.length; i += 1) {
            expect(ciphertext[i]).toBe((plain[i]! ^ keys[i]!) >>> 0);
            expect((ciphertext[i]! ^ keys[i]!) >>> 0).toBe(plain[i]);
        }
        expect(meta?.["skipped"]).toBe(0);
    });

    it("advances to distinct keys and terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
        const frames = [...mod.run({ chainKey: 1, messages: 6 })];
        const keys = new Set(frames[frames.length - 1]?.meta["messageKeys"] as number[]);
        expect(keys.size).toBe(6);
    });
});
