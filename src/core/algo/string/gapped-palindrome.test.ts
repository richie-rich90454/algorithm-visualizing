/**
 * gapped-palindrome.test.ts - Brute-force validity and completeness check,
 * frame shape, and termination for gapped palindrome discovery.
 */

import { describe, expect, it } from "vitest";
import mod from "./gapped-palindrome";

interface Palindrome {
    leftStart: number;
    leftEnd: number;
    rightStart: number;
    rightEnd: number;
    length: number;
    gap: number;
}

function parse(encoded: string[]): Palindrome[] {
    return encoded.map((value) => {
        const [leftStart, leftEnd, rightStart, rightEnd, length, gap] = value.split(",").map(Number);
        return { leftStart, leftEnd, rightStart, rightEnd, length, gap } as Palindrome;
    });
}

/** Independent brute force over every inner pair. */
function brute(text: string): Palindrome[] {
    const result: Palindrome[] = [];
    for (let i = 0; i < text.length; i += 1) {
        for (let j = i + 1; j < text.length; j += 1) {
            if (text[i] !== text[j]) {
                continue;
            }
            let length = 1;
            while (i - length >= 0 && j + length < text.length && text[i - length] === text[j + length]) {
                length += 1;
            }
            result.push({
                leftStart: i - length + 1,
                leftEnd: i,
                rightStart: j,
                rightEnd: j + length - 1,
                length,
                gap: j - i - 1,
            });
        }
    }
    return result;
}

function key(p: Palindrome): string {
    return `${p.leftStart},${p.rightEnd},${p.length}`;
}

describe("Gapped Palindrome", () => {
    it("reports only valid maximal palindromes on the default input", () => {
        const input = mod.defaultInput as { text: string };
        const frames = [...mod.run(input)];
        const last = frames[frames.length - 1];
        const found = parse(last?.meta.palindromes as string[]);
        const text = input.text;
        expect(found.length).toBeGreaterThan(0);
        for (const p of found) {
            expect(text[p.leftStart]).toBe(text[p.rightEnd]);
            for (let t = 0; t < p.length; t += 1) {
                expect(text[p.leftStart + t]).toBe(text[p.rightEnd - t]);
            }
            expect(p.leftEnd - p.leftStart + 1).toBe(p.length);
            expect(p.rightEnd - p.rightStart + 1).toBe(p.length);
            expect(p.gap).toBe(p.rightStart - p.leftEnd - 1);
            const canExtend =
                p.leftStart > 0 && p.rightEnd < text.length - 1 &&
                text[p.leftStart - 1] === text[p.rightEnd + 1];
            expect(canExtend).toBe(false);
        }
    });

    it("finds the same palindrome set as brute force on varied inputs", () => {
        const texts = ["", "a", "aa", "abcxycba", "abccba", "aaaa", "abaxabba", "racecarxx"];
        for (const text of texts) {
            const last = [...mod.run({ text })].pop();
            const found = parse(last?.meta.palindromes as string[]).map(key).sort();
            const expected = brute(text).map(key).sort();
            expect(found, text).toEqual(expected);
        }
    });

    it("respects the minimum arm length", () => {
        const text = "abcxycba";
        const short = parse(([...mod.run({ text, minArm: 1 })].pop()?.meta.palindromes as string[]));
        const long = parse(([...mod.run({ text, minArm: 3 })].pop()?.meta.palindromes as string[]));
        expect(long.length).toBeLessThan(short.length);
        expect(long.every((p) => p.length >= 3)).toBe(true);
    });

    it("every frame is well formed and the generator terminates", () => {
        const input = mod.defaultInput as { text: string };
        const frames = [...mod.run(input)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(typeof frame.description).toBe("string");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("text");
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.size).toBe(frame.entities.length);
            for (const e of frame.entities) {
                expect(e.type).toBe("character");
                expect(Number.isFinite(e.x)).toBe(true);
                expect(Number.isFinite(e.y)).toBe(true);
            }
        });
    });
});
