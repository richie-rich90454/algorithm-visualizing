/**
 * longest-common-extension.test.ts - Brute-force, frame, and termination tests.
 */

import { describe, expect, it } from "vitest";
import mod from "./longest-common-extension";
import type { VisualFrame } from "@/types";

type Query = [number, number];

/** Naive LCE: compare suffixes one character at a time. */
function naiveLce(text: string, i: number, j: number): number {
    let length = 0;
    while (
        i + length < text.length &&
        j + length < text.length &&
        text[i + length] === text[j + length]
    ) {
        length += 1;
    }
    return length;
}

function checkFrames(frames: VisualFrame[], textLength: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(textLength);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Longest Common Extension", () => {
    it("matches a naive character-by-character reference on random inputs", () => {
        let seed = 1337;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        const alphabet = "ab";
        for (let trial = 0; trial < 60; trial += 1) {
            const length = 2 + (rand() % 18);
            let text = "";
            for (let k = 0; k < length; k += 1) {
                text += alphabet[rand() % alphabet.length];
            }
            const queries: Query[] = [];
            for (let k = 0; k < 8; k += 1) {
                queries.push([rand() % length, rand() % length]);
            }
            const frames = [...mod.run({ text, queries })];
            checkFrames(frames, length);
            const final = frames[frames.length - 1]?.meta["results"] as number[];
            expect(final.length).toBe(queries.length);
            queries.forEach(([i, j], idx) => {
                expect(final[idx]).toBe(naiveLce(text, i, j));
            });
        }
    });

    it("matches the default input answers", () => {
        const input = mod.defaultInput as { text: string; queries: Query[] };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta["results"] as number[];
        input.queries.forEach(([i, j], idx) => {
            expect(final[idx]).toBe(naiveLce(input.text, i, j));
        });
    });

    it("handles an empty query list and identical positions", () => {
        const empty = [...mod.run({ text: "abc", queries: [] })];
        expect((empty[empty.length - 1]?.meta["results"] as number[]).length).toBe(0);
        const same = [...mod.run({ text: "abcabc", queries: [[2, 2]] })];
        expect((same[same.length - 1]?.meta["results"] as number[])[0]).toBe(4);
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
