/**
 * rc4a.test.ts - Independent RC4A reference, permutation invariants, XOR
 * round-trip, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { rc4aKsa, rc4aPrga } from "./rc4a";
import type { VisualFrame } from "@/types";

function reference(key: string, length: number): number[] {
    const keyBytes = Array.from(key.length > 0 ? key : "Key", (ch) => ch.charCodeAt(0) & 0xff);
    const a = Array.from({ length: 256 }, (_v, i) => i);
    const b = Array.from({ length: 256 }, (_v, i) => i);
    let ja = 0;
    let jb = 0;
    for (let i = 0; i < 256; i += 1) {
        const k = keyBytes[i % keyBytes.length] as number;
        ja = (ja + (a[i] as number) + k) & 0xff;
        [a[i], a[ja]] = [a[ja] as number, a[i] as number];
        jb = (jb + (b[i] as number) + k) & 0xff;
        [b[i], b[jb]] = [b[jb] as number, b[i] as number];
    }
    let ia = 0;
    let ib = 0;
    ja = 0;
    jb = 0;
    const out: number[] = [];
    for (let n = 0; n < Math.ceil(length / 2); n += 1) {
        ia = (ia + 1) & 0xff;
        ja = (ja + (a[ia] as number)) & 0xff;
        [a[ia], a[ja]] = [a[ja] as number, a[ia] as number];
        out.push(a[((a[ia] as number) + (a[ja] as number)) & 0xff] as number);
        ib = (ib + 1) & 0xff;
        jb = (jb + (b[ib] as number)) & 0xff;
        [b[ib], b[jb]] = [b[jb] as number, b[ib] as number];
        out.push(b[((b[ib] as number) + (b[jb] as number)) & 0xff] as number);
    }
    return out.slice(0, length);
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

describe("RC4A Stream Cipher", () => {
    it("matches an independent keystream reference on many keys and lengths", () => {
        for (const key of ["Key", "Wiki", "Secret", "a", "", "attack-at-dawn"]) {
            for (const length of [0, 1, 2, 7, 16, 33]) {
                expect(rc4aPrga(rc4aKsa(key), length)).toEqual(reference(key, length));
            }
        }
    });

    it("keeps both state boxes as permutations after key setup", () => {
        for (const key of ["Key", "Secret", "x", "longer teaching key"]) {
            const state = rc4aKsa(key);
            for (const box of [state.s1, state.s2]) {
                const sorted = [...box].sort((a, b) => a - b);
                expect(sorted).toEqual(Array.from({ length: 256 }, (_v, i) => i));
            }
        }
    });

    it("produces deterministic keystreams and round-trips a plaintext", () => {
        const plaintext = "Attack at dawn";
        const key = "Key";
        const frames = [...mod.run({ key, plaintext })];
        checkFrames(frames, plaintext.length);
        const final = frames[frames.length - 1]?.meta;
        expect(rc4aPrga(rc4aKsa(key), plaintext.length)).toEqual(final?.["keystream"]);
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
