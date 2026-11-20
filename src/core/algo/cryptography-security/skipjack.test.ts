/**
 * skipjack.test.ts - Feistel invertibility over many inputs, key dependence, diffusion, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { decryptBlock, encryptBlock } from "./skipjack";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("bar");
            const b = entity.value as number;
            expect(b).toBeGreaterThanOrEqual(0);
            expect(b).toBeLessThanOrEqual(255);
        }
    });
}

function toHex(bytes: number[]): string {
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("SkipjackToy", () => {
    it("recovers every one of 200 random plaintext and key pairs", () => {
        let seed = 987654321;
        const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 256);
        for (let trial = 0; trial < 200; trial += 1) {
            const plain = Array.from({ length: 8 }, () => rnd());
            const key = Array.from({ length: 10 }, () => rnd());
            const states = encryptBlock(plain, key);
            const cipher = states[states.length - 1]!;
            const back = decryptBlock(cipher, key)[8]!;
            expect(toHex(back)).toBe(toHex(plain));
        }
    });

    it("produces different ciphertexts for different keys and plaintexts", () => {
        const plain = [1, 2, 3, 4, 5, 6, 7, 8];
        const keyA = Array.from({ length: 10 }, (_, i) => (i * 7 + 1) % 256);
        const keyB = Array.from({ length: 10 }, (_, i) => (i * 11 + 3) % 256);
        const cA = encryptBlock(plain, keyA)[8]!;
        const cB = encryptBlock(plain, keyB)[8]!;
        expect(toHex(cA)).not.toBe(toHex(cB));
        const changed = plain.slice();
        changed[0] = changed[0]! ^ 1;
        expect(toHex(encryptBlock(changed, keyA)[8]!)).not.toBe(toHex(cA));
    });

    it("reports a verified roundtrip in the frame metadata", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["decryptsBack"]).toBe(true);
        expect(last["round"]).toBe(8);
        expect(last["ciphertext"]).toMatch(/^[0-9a-f]{16}$/);
        const distinct = new Set(frames.slice(1, 9).map((f) => f.meta["ciphertext"]));
        expect(distinct.size).toBe(8);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
