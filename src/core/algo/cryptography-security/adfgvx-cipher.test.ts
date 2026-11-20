/** adfgvx-cipher.test.ts - Independent cipher, round trips, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./adfgvx-cipher";
import type { VisualFrame } from "@/types";

const COORDS = "ADFGVX";
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function clean(t: string): string {
    return t.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function square(key: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of clean(key) + CHARS) {
        if (!seen.has(c)) {
            seen.add(c);
            out.push(c);
        }
    }
    return out.slice(0, 36);
}

function order(key: string): number[] {
    const k = key.toUpperCase().replace(/[^A-Z]/g, "");
    return Array.from({ length: k.length }, (_, i) => i).sort((a, b) =>
        (k[a] ?? "").charCodeAt(0) - (k[b] ?? "").charCodeAt(0) || a - b,
    );
}

function reference(plain: string, sqKey: string, colKey: string): string {
    const sq = square(sqKey);
    const ord = order(colKey);
    const codes: string[] = [];
    for (const ch of clean(plain)) {
        const idx = sq.indexOf(ch);
        codes.push(COORDS[Math.floor(idx / 6)] ?? "A", COORDS[idx % 6] ?? "A");
    }
    const cols = ord.length;
    const rows = Math.ceil(codes.length / cols);
    const deficit = rows * cols - codes.length;
    const out: string[] = [];
    for (const col of ord) {
        const count = rows - (col >= cols - deficit ? 1 : 0);
        for (let r = 0; r < count; r += 1) {
            out.push(codes[r * cols + col] ?? "A");
        }
    }
    return out.join("");
}

function checkFrames(frames: VisualFrame[], chars: number): void {
    expect(frames.length).toBe(chars + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(36);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("AdfgvxCipher", () => {
    it("matches an independent encryptor", () => {
        const inputs = [
            { plaintext: "ATTACKATDAWN", squareKey: "KEYWORD", columnKey: "PRIVACY" },
            { plaintext: "HELLO2026WORLD", squareKey: "ZEBRA", columnKey: "CODE" },
            { plaintext: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", squareKey: "KEYWORD", columnKey: "FORTIFICATION" },
        ];
        for (const input of inputs) {
            const frames = [...mod.run(input)];
            const expected = reference(input.plaintext, input.squareKey, input.columnKey);
            checkFrames(frames, clean(input.plaintext).length);
            expect(frames[frames.length - 1]?.meta["ciphertext"]).toBe(expected);
        }
    });

    it("round trips many random messages with varying key lengths", () => {
        let seed = 41;
        const alphabet = CHARS;
        for (let trial = 0; trial < 25; trial += 1) {
            let text = "";
            const len = 6 + (trial % 9);
            for (let i = 0; i < len; i += 1) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                text += alphabet[seed % 36];
            }
            const colKey = ["CODE", "PRIVACY", "ZEBRAKEY", "FORT"][trial % 4] ?? "KEY";
            const frames = [...mod.run({ plaintext: text, squareKey: "KEYWORD", columnKey: colKey })];
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
        expect(count).toBe(15);
        expect(generator.next().done).toBe(true);
    });
});
