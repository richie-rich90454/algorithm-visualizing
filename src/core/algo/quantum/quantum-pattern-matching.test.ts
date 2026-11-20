/**
 * quantum-pattern-matching.test.ts - Match enumeration and amplification checks.
 */

import { describe, expect, it } from "vitest";
import mod, { matchPositions } from "./quantum-pattern-matching";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent slow comparator used as the brute-force reference. */
function bruteMatches(text: number[], pattern: number[]): number[] {
    const out: number[] = [];
    for (let s = 0; s <= text.length - pattern.length; s += 1) {
        let ok = true;
        for (let j = 0; j < pattern.length; j += 1) {
            if (text[s + j] !== pattern[j]) {
                ok = false;
            }
        }
        if (ok) {
            out.push(s);
        }
    }
    return out;
}

describe("Quantum Pattern Matching", () => {
    it("enumerates alignments identically to a brute-force comparator", () => {
        const text = [4, 5, 4, 5, 5, 4, 5];
        const pattern = [4, 5];
        expect(matchPositions(text, pattern)).toEqual(bruteMatches(text, pattern));
        expect(matchPositions(text, [9])).toEqual([]);
    });

    it("boosts the probability of true matches", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const matches = final?.["matches"] as number[];
        expect(matches).toEqual(bruteMatches([1, 2, 3, 1, 2, 1, 2, 3], [1, 2]));
        expect(Number(final?.["success"])).toBeGreaterThan(0.5);
        expect(matches).toContain(final?.["found"]);
        const probabilities = final?.["probabilities"] as number[];
        expect(probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    });

    it("reports no match for an absent pattern", () => {
        const frames = [...mod.run({ text: [1, 2, 3], pattern: [9] })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["found"]).toBeNull();
        expect(Number(final?.["success"])).toBe(0);
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
