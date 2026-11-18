/**
 * playfair-cipher.test.ts - Reference cipher, round trips, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./playfair-cipher";
import type { VisualFrame } from "@/types";

const ALPHABET = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

function clean(text: string): string {
    return text.toUpperCase().replace(/J/g, "I").replace(/[^A-Z]/g, "");
}

function square(keyword: string): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const letter of clean(keyword)) {
        if (!seen.has(letter)) {
            seen.add(letter);
            result.push(letter);
        }
    }
    for (const letter of ALPHABET) {
        if (!seen.has(letter)) {
            seen.add(letter);
            result.push(letter);
        }
    }
    return result;
}

function locate(grid: string[], letter: string): [number, number] {
    const at = grid.indexOf(letter);
    return [Math.floor(at / 5), at % 5];
}

function pair(grid: string[], text: string, decrypt: boolean): string {
    const [r1, c1] = locate(grid, text[0] ?? "A");
    const [r2, c2] = locate(grid, text[1] ?? "A");
    const step = decrypt ? 4 : 1;
    if (r1 === r2) {
        return grid[r1 * 5 + ((c1 + step) % 5)]! + grid[r2 * 5 + ((c2 + step) % 5)]!;
    }
    if (c1 === c2) {
        return grid[((r1 + step) % 5) * 5 + c1]! + grid[((r2 + step) % 5) * 5 + c2]!;
    }
    return grid[r1 * 5 + c2]! + grid[r2 * 5 + c1]!;
}

function encrypt(plain: string, keyword: string): string {
    const grid = square(keyword);
    let text = clean(plain);
    if (text.length % 2 === 1) {
        text += "X";
    }
    const out: string[] = [];
    for (let i = 0; i < text.length; i += 2) {
        out.push(pair(grid, text.slice(i, i + 2), false));
    }
    return out.join("");
}

function checkFrames(frames: VisualFrame[], pairs: number): void {
    expect(frames.length).toBe(pairs + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(5 * (5 + pairs));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("PlayfairCipher", () => {
    it("matches a reference encryptor on even-length messages", () => {
        const cases = [
            { plaintext: "ATTACKATDAWN", keyword: "PLAYFAIR" },
            { plaintext: "HELLOWORLD", keyword: "MONARCHY" },
            { plaintext: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", keyword: "KEYWORD" },
            { plaintext: "INMEETINGATNOON", keyword: "JUJUTSU" },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, Math.ceil(clean(input.plaintext).length / 2));
            const meta = frames[frames.length - 1]?.meta;
            const normalized = clean(input.plaintext);
            const padded = normalized.length % 2 === 1 ? `${normalized}X` : normalized;
            expect(meta?.["ciphertext"]).toBe(encrypt(input.plaintext, input.keyword));
            expect(meta?.["plaintext"]).toBe(padded);
            expect(String(meta?.["ciphertext"]).length).toBe(padded.length);
        }
    });

    it("round trips random messages and keeps a 25-letter square", () => {
        const grid = square("PLAYFAIR");
        expect(grid.length).toBe(25);
        expect(new Set(grid).size).toBe(25);
        let seed = 7;
        for (let trial = 0; trial < 20; trial += 1) {
            let text = "";
            for (let i = 0; i < 8; i += 1) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                text += ALPHABET[seed % 25];
            }
            const frames = [...mod.run({ plaintext: text, keyword: "PLAYFAIR" })];
            checkFrames(frames, text.length / 2);
            expect(frames[frames.length - 1]?.meta["plaintext"]).toBe(text);
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
