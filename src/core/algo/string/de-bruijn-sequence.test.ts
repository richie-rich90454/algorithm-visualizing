/**
 * de-bruijn-sequence.test.ts - Brute-force universality check, frame shape,
 * and termination for de Bruijn sequence generation.
 */

import { describe, expect, it } from "vitest";
import mod from "./de-bruijn-sequence";

/** All length-n strings over an alphabet, as a set. */
function allStrings(alphabet: string, n: number): Set<string> {
    let current = [""];
    for (let i = 0; i < n; i += 1) {
        const next: string[] = [];
        for (const prefix of current) {
            for (const symbol of alphabet) {
                next.push(prefix + symbol);
            }
        }
        current = next;
    }
    return new Set(current);
}

/** Every cyclic window of length n in a sequence. */
function cyclicWindows(sequence: string, n: number): string[] {
    const windows: string[] = [];
    for (let i = 0; i < sequence.length; i += 1) {
        let window = "";
        for (let k = 0; k < n; k += 1) {
            window += sequence[(i + k) % sequence.length];
        }
        windows.push(window);
    }
    return windows;
}

describe("de Bruijn Sequence", () => {
    it("contains every binary order-three window exactly once", () => {
        const input = mod.defaultInput as { alphabet: string; order: number };
        const frames = [...mod.run(input)];
        const last = frames[frames.length - 1];
        const sequence = last?.meta.sequence as string;
        expect(sequence).toHaveLength(2 ** 3);
        const windows = cyclicWindows(sequence, 3);
        expect(new Set(windows).size).toBe(windows.length);
        expect(new Set(windows)).toEqual(allStrings("01", 3));
        expect(last?.meta.edgeCount).toBe(8);
    });

    it("is universal for several alphabets and orders", () => {
        const cases: Array<{ alphabet: string; order: number }> = [
            { alphabet: "01", order: 1 },
            { alphabet: "01", order: 2 },
            { alphabet: "01", order: 4 },
            { alphabet: "abc", order: 2 },
            { alphabet: "abcd", order: 2 },
        ];
        for (const item of cases) {
            const frames = [...mod.run(item)];
            const last = frames[frames.length - 1];
            const sequence = last?.meta.sequence as string;
            const expectedCount = item.alphabet.length ** item.order;
            expect(sequence, JSON.stringify(item)).toHaveLength(expectedCount);
            const windows = cyclicWindows(sequence, item.order);
            expect(new Set(windows).size, `unique windows ${JSON.stringify(item)}`).toBe(expectedCount);
            expect(new Set(windows), JSON.stringify(item)).toEqual(allStrings(item.alphabet, item.order));
        }
    });

    it("every frame is well formed and the generator terminates", () => {
        const input = mod.defaultInput as { alphabet: string; order: number };
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
            expect(frame.meta.expectedCount).toBe(8);
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
