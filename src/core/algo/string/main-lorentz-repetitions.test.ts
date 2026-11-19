/** Correctness, frame shape, and termination checks for Main-Lorentz. */
import { describe, expect, it } from "vitest";
import mod from "./main-lorentz-repetitions";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) expect(entity.id).toBeTruthy();
    });
}

/** Exhaustive enumeration of every tandem repeat XX. */
function brute(text: string): string[] {
    const result: string[] = [];
    for (let i = 0; i < text.length; i += 1) {
        for (let p = 1; i + 2 * p <= text.length; p += 1) {
            if (text.slice(i, i + p) === text.slice(i + p, i + 2 * p)) result.push(`${i}:${p}`);
        }
    }
    return result.sort();
}

describe("Main-Lorentz Repetition Finding", () => {
    const cases = ["abababa", "aaaa", "abcabcabc", "abacaba", "abcde", "aaabaaa", "abababab", "x"];

    for (const s of cases) {
        it(`finds exactly all repetitions in ${JSON.stringify(s)}`, () => {
            const frames = [...mod.run({ s })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const got = (final?.["repetitions"] as string).split(" ").filter(Boolean).sort();
            expect(got).toEqual(brute(s));
            expect(final?.["count"]).toBe(brute(s).length);
        });
    }

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
