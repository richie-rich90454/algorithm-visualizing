/** trifid-cipher.test.ts - Independent cipher, round trips, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./trifid-cipher";
import type { VisualFrame } from "@/types";

const ALPHABET = "ABCDEFGHIKLMNOPQRSTUVWXYZ01";

function clean(t: string): string {
    return t.toUpperCase().replace(/J/g, "I").replace(/[^A-Z0-9]/g, "");
}

function cube(key: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of clean(key) + ALPHABET) {
        if (!seen.has(c)) {
            seen.add(c);
            out.push(c);
        }
    }
    return out.slice(0, 27);
}

function referenceEncrypt(plain: string, key: string): string {
    const c = cube(key);
    const l: number[] = [];
    const r: number[] = [];
    const col: number[] = [];
    for (const ch of clean(plain)) {
        const i = c.indexOf(ch);
        l.push(Math.floor(i / 9));
        r.push(Math.floor((i % 9) / 3));
        col.push(i % 3);
    }
    const stream = [...l, ...r, ...col];
    const out: string[] = [];
    for (let i = 0; i + 2 < stream.length; i += 3) {
        out.push(c[(stream[i] ?? 0) * 9 + (stream[i + 1] ?? 0) * 3 + (stream[i + 2] ?? 0)] ?? "A");
    }
    return out.join("");
}

function checkFrames(frames: VisualFrame[], chars: number): void {
    expect(frames.length).toBe(chars + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(27);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("TrifidCipher", () => {
    it("matches an independent encryptor", () => {
        for (const input of [
            { plaintext: "ATTACKATDAWN", key: "TRIFID" },
            { plaintext: "HELLO2026WORLD", key: "ZEBRA" },
            { plaintext: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", key: "KEYWORD" },
        ]) {
            const frames = [...mod.run(input)];
            checkFrames(frames, clean(input.plaintext).length);
            expect(frames[frames.length - 1]?.meta["ciphertext"]).toBe(
                referenceEncrypt(input.plaintext, input.key),
            );
        }
    });

    it("round trips many random messages", () => {
        let seed = 59;
        for (let trial = 0; trial < 30; trial += 1) {
            const len = 5 + (trial % 12);
            let text = "";
            for (let i = 0; i < len; i += 1) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                text += ALPHABET[seed % 27];
            }
            const frames = [...mod.run({ plaintext: text, key: "TRIFID" })];
            checkFrames(frames, text.length);
            expect(frames[frames.length - 1]?.meta["plaintext"]).toBe(text);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(14);
        expect(generator.next().done).toBe(true);
    });
});
