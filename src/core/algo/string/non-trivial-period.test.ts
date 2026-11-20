/**
 * non-trivial-period.test.ts - Brute-force period set, KMP prefix values,
 * shortest period, empty and aperiodic cases, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./non-trivial-period";
import type { VisualFrame } from "@/types";

function brute(text: string): number[] {
    const n = text.length;
    const out: number[] = [];
    for (let p = 1; p < n; p += 1) {
        let isPeriod = true;
        for (let i = 0; i + p < n; i += 1) {
            if (text[i] !== text[i + p]) {
                isPeriod = false;
                break;
            }
        }
        if (isPeriod) out.push(p);
    }
    return out;
}

function referencePrefix(text: string): number[] {
    const pi = Array<number>(text.length).fill(0);
    for (let i = 1; i < text.length; i += 1) {
        let j = pi[i - 1] ?? 0;
        while (j > 0 && text[i] !== text[j]) j = pi[j - 1] ?? 0;
        if (text[i] === text[j]) j += 1;
        pi[i] = j;
    }
    return pi;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("NonTrivialPeriod", () => {
    it("matches a brute-force period check on many strings", () => {
        const texts = ["abababab", "aaaa", "abcabcabc", "abacaba", "banana", "aaabaaab", "x", "abcde", "mnmnmnmn"];
        for (const text of texts) {
            const frames = [...mod.run({ text })];
            checkFrames(frames, text.length);
            expect(frames[frames.length - 1].meta["periods"]).toEqual(brute(text));
        }
    });

    it("computes the same prefix table as an independent KMP", () => {
        const text = "ababacaba";
        const frames = [...mod.run({ text })];
        expect(frames[frames.length - 2].meta["pi"]).toEqual(referencePrefix(text));
    });

    it("reports the shortest period and handles degenerate texts", () => {
        const final = (text: string) => [...mod.run({ text })].at(-1);
        expect(final("abababab")?.meta["minimalPeriod"]).toBe(2);
        expect(final("aaaa")?.meta["periods"]).toEqual([1, 2, 3]);
        expect(final("abcde")?.meta["periods"]).toEqual([]);
        expect(final("")?.meta["periods"]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBe(1 + 7 + 1);
        expect(generator.next().done).toBe(true);
    });
});
