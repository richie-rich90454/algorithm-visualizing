/** aes-gcm-encryption.test.ts - Correctness and frame checks for the toy model. */

import { describe, expect, it } from "vitest";
import mod from "./aes-gcm-encryption";
import type { VisualFrame } from "@/types";

interface Input {
    plaintext: number[];
    keystream: number[];
    authKey: number;
}

/** Independent toy encryption and tag reference. */
function reference(input: Input) {
    const cipher = input.plaintext.map((value, i) => (value ^ input.keystream[i]!) & 0xff);
    let tag = input.authKey & 0xff;
    for (const value of cipher) {
        tag = (tag ^ value) & 0xff;
    }
    const recovered = cipher.map((value, i) => (value ^ input.keystream[i]!) & 0xff);
    return { cipher, tag, recovered };
}

function checkFrames(frames: VisualFrame[], byteCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThanOrEqual(byteCount * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.meta["rows"]).toBe(4);
        expect(frame.meta["cols"]).toBe(byteCount);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("AES-GCM toy model", () => {
    it("matches an independent XOR and tag reference", () => {
        const cases: Input[] = [
            { plaintext: [0x48, 0x69, 0x21, 0x2a], keystream: [0x1f, 0x2e, 0x3d, 0x4c], authKey: 0x5a },
            { plaintext: [0, 255, 7, 16, 42], keystream: [9, 8, 7, 6, 5], authKey: 31 },
            { plaintext: [1, 2, 3], keystream: [4, 5, 6], authKey: 0 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.plaintext.length);
            const expected = reference(input);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["ciphertext"]).toEqual(expected.cipher);
            expect(finalMeta?.["tag"]).toBe(expected.tag);
            expect(finalMeta?.["plaintext"]).toEqual(expected.recovered);
            expect(finalMeta?.["authenticated"]).toBe(true);
            expect(finalMeta?.["plaintext"]).toEqual(input.plaintext);
        }
    });

    it("changes the authentication tag when any cipher byte changes", () => {
        const base: Input = { plaintext: [10, 20, 30, 40], keystream: [1, 2, 3, 4], authKey: 7 };
        const originalTag = reference(base).tag;
        for (let i = 0; i < base.keystream.length; i += 1) {
            const changedStream = base.keystream.slice();
            changedStream[i] = (changedStream[i]! + 1) & 0xff;
            expect(reference({ ...base, keystream: changedStream }).tag).not.toBe(originalTag);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
