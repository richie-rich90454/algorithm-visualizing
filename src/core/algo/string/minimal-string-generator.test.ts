/**
 * minimal-string-generator.test.ts - Independent generator reconstruction,
 * uniqueness property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./minimal-string-generator";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.every((entity) => entity.type === "character")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent method: try increasing lengths and test against earlier starts. */
function bruteGenerators(text: string): number[] {
    const n = text.length;
    const result: number[] = [];
    for (let i = 0; i < n; i += 1) {
        let length = 1;
        while (length <= n - i) {
            const prefix = text.slice(i, i + length);
            let occursEarlier = false;
            for (let j = 0; j < i; j += 1) {
                if (j + length <= n && text.slice(j, j + length) === prefix) {
                    occursEarlier = true;
                    break;
                }
            }
            if (!occursEarlier) break;
            length += 1;
        }
        result.push(Math.min(length, Math.max(1, n - i)));
    }
    return result;
}

describe("Minimal String Generator", () => {
    const texts = ["ababac", "aaaaa", "abcabcabc", "ab", "zzzzabzzzzab"];

    it("matches independent reconstruction across several texts", () => {
        for (const text of texts) {
            const frames = [...mod.run({ text })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!;
            expect(final.meta["generators"]).toEqual(bruteGenerators(text));
            expect(final.meta["generatorSubstrings"]).toHaveLength(text.length);
        }
    });

    it("each reported generator is unique to its start and minimal", () => {
        for (const text of texts) {
            const frames = [...mod.run({ text })];
            const generators = frames[frames.length - 1]!.meta["generators"] as number[];
            const substrings = frames[frames.length - 1]!.meta["generatorSubstrings"] as string[];
            generators.forEach((length, i) => {
                const generator = substrings[i]!;
                expect(generator).toBe(text.slice(i, i + length));
                if (length === 1 && i === 0) return;
                // A suffix fully contained in an earlier suffix has no distinguishing
                // prefix; its generator is the whole remaining suffix and may recur.
                if (length === text.length - i) return;
                for (let j = 0; j < i; j += 1) {
                    expect(j + length > text.length || text.slice(j, j + length) !== generator).toBe(true);
                }
                if (length > 1) {
                    const shorter = text.slice(i, i + length - 1);
                    const foundEarlier = Array.from({ length: i }, (_value, j) => j).some(
                        (j) => j + shorter.length <= text.length && text.slice(j, j + shorter.length) === shorter,
                    );
                    expect(foundEarlier).toBe(true);
                }
            });
        }
    });

    it("handles an empty text and terminates", () => {
        const empty = [...mod.run({ text: "" })];
        checkFrames(empty);
        expect(empty[empty.length - 1]!.meta["generators"]).toEqual([]);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
