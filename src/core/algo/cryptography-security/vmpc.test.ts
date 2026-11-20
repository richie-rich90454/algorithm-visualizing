/**
 * vmpc.test.ts - Independent VMPC reference, permutation invariant, XOR
 * round-trip, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { vmpcKsa, vmpcKeystream, vmpcStep } from "./vmpc";
import type { VisualFrame } from "@/types";

function reference(key: string, length: number): number[] {
    const keyBytes = Array.from(key.length > 0 ? key : "Key", (ch) => ch.charCodeAt(0) & 0xff);
    const s = Array.from({ length: 256 }, (_v, i) => i);
    let j = 0;
    for (let i = 0; i < 256; i += 1) {
        j = (j + (s[i] as number) + (keyBytes[i % keyBytes.length] as number)) & 0xff;
        [s[i], s[j]] = [s[j] as number, s[i] as number];
    }
    for (let round = 0; round < 768; round += 1) {
        const i = round & 0xff;
        j = (j + (s[i] as number) + (keyBytes[i % keyBytes.length] as number)) & 0xff;
        [s[i], s[j]] = [s[j] as number, s[i] as number];
    }
    let n = 0;
    const out: number[] = [];
    for (let i = 0; i < length; i += 1) {
        j = s[(n + (s[j] as number)) & 0xff] as number;
        out.push(s[((s[j] as number) + (s[n] as number)) & 0xff] as number);
        [s[n], s[j]] = [s[j] as number, s[n] as number];
        n = (n + 1) & 0xff;
    }
    return out;
}

function checkFrames(frames: VisualFrame[], streamLength: number): void {
    expect(frames.length).toBe(streamLength + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(streamLength);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("VMPC Stream Cipher", () => {
    it("matches an independent keystream reference on many keys and lengths", () => {
        for (const key of ["Key", "Secret", "a", "", "teaching-key"]) {
            for (const length of [0, 1, 2, 8, 17, 32]) {
                expect(vmpcKeystream(key, length)).toEqual(reference(key, length));
            }
        }
    });

    it("keeps the table a permutation and advances n by one each step", () => {
        const state = vmpcKsa("Key");
        const sorted = [...state.s].sort((a, b) => a - b);
        expect(sorted).toEqual(Array.from({ length: 256 }, (_v, i) => i));
        for (let i = 0; i < 100; i += 1) {
            const byte = vmpcStep(state);
            expect(byte).toBeGreaterThanOrEqual(0);
            expect(byte).toBeLessThanOrEqual(255);
            expect(state.n).toBe((i + 1) & 0xff);
            expect([...state.s].sort((a, b) => a - b)).toEqual(Array.from({ length: 256 }, (_v, i) => i));
        }
    });

    it("round-trips a plaintext with the generated keystream", () => {
        const plaintext = "Attack at dawn";
        const key = "Key";
        const frames = [...mod.run({ key, plaintext })];
        checkFrames(frames, plaintext.length);
        const final = frames[frames.length - 1]?.meta;
        expect(vmpcKeystream(key, plaintext.length)).toEqual(final?.["keystream"]);
        const cipher = final?.["ciphertext"] as number[];
        const decrypted = cipher.map((byte, index) => byte ^ ((final?.["keystream"] as number[])[index] ?? 0));
        expect(decrypted).toEqual(Array.from(plaintext, (ch) => ch.charCodeAt(0)));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
