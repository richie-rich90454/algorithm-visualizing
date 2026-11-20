/** scramble-string.test.ts - Brute-force scramble check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import scrambleString from "./scramble-string";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? -1).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 999).toBeLessThan(scrambleString.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("grid");
        expect(frame.meta).toBeTypeOf("object");
        frame.entities.forEach((entity) => expect(entity.type).toBe("cell"));
    });
}

function sumAll(generator: Generator<VisualFrame, void, unknown>): VisualFrame[] {
    const frames: VisualFrame[] = [];
    for (const frame of generator) {
        frames.push(frame);
        expect(frames.length).toBeLessThan(100000);
    }
    return frames;
}

/** Generate every string reachable by recursive cuts and swaps. */
function allScrambles(text: string): Set<string> {
    if (text.length <= 1) {
        return new Set([text]);
    }
    const result = new Set<string>();
    for (let split = 1; split < text.length; split += 1) {
        for (const left of allScrambles(text.slice(0, split))) {
            for (const right of allScrambles(text.slice(split))) {
                result.add(left + right);
                result.add(right + left);
            }
        }
    }
    return result;
}

describe("Scramble String", () => {
    it("matches brute-force scramble generation", () => {
        const cases = [
            ["great", "rgeat"],
            ["abcde", "caebd"],
            ["ab", "ba"],
            ["abc", "abc"],
            ["ab", "cd"],
            ["abcd", "badc"],
            ["abcde", "edcba"],
        ];
        for (const [s1, s2] of cases) {
            const frames = sumAll(scrambleString.run({ s1, s2 }));
            const final = frames[frames.length - 1];
            expect(final?.meta["answer"]).toBe(allScrambles(s1 as string).has(s2 as string));
        }
    });

    it("emits well-formed frames and terminates on the default input", () => {
        checkFrames(sumAll(scrambleString.run(scrambleString.defaultInput)));
        const generator = scrambleString.run(scrambleString.defaultInput);
        let count = 0;
        while (generator.next().done !== true) {
            count += 1;
            expect(count).toBeLessThan(100000);
        }
    });
});
