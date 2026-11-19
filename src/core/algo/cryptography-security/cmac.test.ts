/** cmac.test.ts - Independent toy-cipher/CMAC reference, exhaustive brute force, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { cmacTag, subkeys, toyEncrypt } from "./cmac";
import type { VisualFrame } from "@/types";

const M = 0xffff;
const RB = 0x100b;

/** Independent re-derivation of the toy Feistel block cipher. */
function refEncrypt(key: number, block: number): number {
    const ks = [(key >>> 8) & 0xff, key & 0xff, (key >>> 4) & 0xff, (key << 3) & 0xff];
    let L = block >> 8;
    let R = block & 0xff;
    for (let r = 0; r < 4; r += 1) {
        const k = ks[r] ?? 0;
        const f = (Math.imul(R ^ k, r + 3) + r * 47) ^ ((R << 3) | (R >>> 5));
        const nL = R;
        const nR = L ^ f;
        L = nL;
        R = nR & 0xff;
    }
    return ((L << 8) | R) & M;
}

function refTag(bytes: number[], key: number): number {
    const dbl = (v: number): number => ((v << 1) & M) ^ ((v & 0x8000) !== 0 ? RB : 0);
    const l = refEncrypt(key, 0);
    const k1 = dbl(l);
    const k2 = dbl(k1);
    const parts: number[] = [];
    let i = 0;
    while (i + 2 <= bytes.length) {
        parts.push(((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0));
        i += 2;
    }
    if (i === bytes.length && bytes.length > 0) {
        parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) ^ k1;
    } else {
        let p = 0x8000;
        for (let j = i; j < bytes.length; j += 1) {
            p |= (bytes[j] ?? 0) << (8 * (1 - (j - i)));
        }
        parts.push(p ^ k2);
    }
    let chain = 0;
    for (let j = 0; j < parts.length - 1; j += 1) {
        chain = refEncrypt(key, chain ^ (parts[j] ?? 0));
    }
    return refEncrypt(key, chain ^ (parts[parts.length - 1] ?? 0));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("CMAC Message Authentication Code", () => {
    it("exhaustively matches the independent reference on every one- and two-byte message", () => {
        for (const key of [0, 1, 0x2b3c, 0xffff, 0x1234]) {
            expect(subkeys(key).l).toBe(refEncrypt(key, 0));
            for (let a = 0; a < 256; a += 1) {
                expect(cmacTag([a], key)).toBe(refTag([a], key));
                for (let b = 0; b < 256; b += 1) {
                    expect(cmacTag([a, b], key)).toBe(refTag([a, b], key));
                }
            }
        }
    });

    it("the toy block cipher is a permutation and its subkeys are distinct", () => {
        const seen = new Set<number>();
        for (let block = 0; block <= M; block += 1) {
            seen.add(toyEncrypt(0x2b3c, block));
        }
        expect(seen.size).toBe(M + 1);
        expect(subkeys(0x2b3c).k1).not.toBe(subkeys(0x2b3c).k2);
    });

    it("changes the tag when the message or key changes", () => {
        const base = cmacTag([104, 101, 108, 108, 111], 0x2b3c);
        expect(cmacTag([104, 101, 108, 108, 112], 0x2b3c)).not.toBe(base);
        expect(cmacTag([104, 101, 108, 108, 111], 0x2b3d)).not.toBe(base);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) {
            frames.push(frame);
        }
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["tag"]).toBe(
            cmacTag(Array.from(new TextEncoder().encode("hello")), 11196).toString(16).padStart(4, "0"),
        );
        expect(generator.next().done).toBe(true);
    });
});
