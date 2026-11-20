/** four-square-cipher.test.ts - Independent cipher, round trips, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./four-square-cipher";
import type { VisualFrame } from "@/types";

const ALPHABET = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

function clean(text: string): string {
    return text.toUpperCase().replace(/J/g, "I").replace(/[^A-Z]/g, "");
}

function sq(key: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of clean(key) + ALPHABET) {
        if (!seen.has(c)) {
            seen.add(c);
            out.push(c);
        }
    }
    return out;
}

function at(s: string[], c: string): [number, number] {
    const i = s.indexOf(c);
    return [Math.floor(i / 5), i % 5];
}

function referenceEncrypt(plain: string, keys: string[]): { cipher: string; padded: string } {
    const [tl, br, tr, bl] = keys.map(sq);
    let text = clean(plain);
    if (text.length % 2 === 1) {
        text += "X";
    }
    const out: string[] = [];
    for (let i = 0; i < text.length; i += 2) {
        const [r1, c1] = at(tl!, text[i] ?? "A");
        const [r2, c2] = at(br!, text[i + 1] ?? "A");
        out.push(tr![r1 * 5 + c2] ?? "A", bl![r2 * 5 + c1] ?? "A");
    }
    return { cipher: out.join(""), padded: text };
}

function checkFrames(frames: VisualFrame[], pairs: number): void {
    expect(frames.length).toBe(pairs + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(100);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(10);
        expect(frame.meta["cols"]).toBe(10);
    });
}

describe("FourSquareCipher", () => {
    it("matches an independent encryptor on fixed messages", () => {
        const keys = ["EXAMPLE", "PLAYFAIR", "KEYWORD", "MONARCHY"];
        const cases = ["ATTACKATDAWN", "HELLOWORLD", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "MEETMEATNOON"];
        for (const plaintext of cases) {
            const frames = [...mod.run({ plaintext, keys })];
            const expected = referenceEncrypt(plaintext, keys);
            checkFrames(frames, expected.padded.length / 2);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["ciphertext"]).toBe(expected.cipher);
            expect(final?.["plaintext"]).toBe(expected.padded);
        }
    });

    it("round trips many random messages", () => {
        const keys = ["EXAMPLE", "PLAYFAIR", "KEYWORD", "MONARCHY"];
        let seed = 11;
        for (let trial = 0; trial < 30; trial += 1) {
            let text = "";
            for (let i = 0; i < 10; i += 1) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                text += ALPHABET[seed % 25];
            }
            const expected = referenceEncrypt(text, keys);
            const frames = [...mod.run({ plaintext: text, keys })];
            checkFrames(frames, expected.padded.length / 2);
            expect(frames[frames.length - 1]?.meta["plaintext"]).toBe(expected.padded);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
