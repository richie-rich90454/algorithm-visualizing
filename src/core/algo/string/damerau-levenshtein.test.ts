/**
 * damerau-levenshtein.test.ts
 * Correctness is checked against an independent top-down memoized reference
 * implementation of the optimal-string-alignment recurrence, plus distance
 * properties and frame-shape invariants.
 */

import { describe, expect, it } from "vitest";
import mod from "./damerau-levenshtein";

/** Independent recursive reference with memoization (top-down vs the module's bottom-up). */
function reference(a: string, b: string): number {
    const memo = new Map<string, number>();
    const rec = (i: number, j: number): number => {
        const key = `${i},${j}`;
        const cached = memo.get(key);
        if (cached !== undefined) return cached;
        let best: number;
        if (i === 0) best = j;
        else if (j === 0) best = i;
        else {
            best = Math.min(
                rec(i - 1, j - 1) + (a[i - 1] === b[j - 1] ? 0 : 1),
                rec(i - 1, j) + 1,
                rec(i, j - 1) + 1,
            );
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                best = Math.min(best, rec(i - 2, j - 2) + 1);
            }
        }
        memo.set(key, best);
        return best;
    };
    return rec(a.length, b.length);
}

function finalDistance(a: string, b: string): number {
    const frames = [...mod.run({ a, b })];
    const last = frames[frames.length - 1] as (typeof frames)[number];
    return last.meta["distance"] as number;
}

function allFrames(input: unknown) {
    return [...mod.run(input)];
}

function checkFrameShapes(input: unknown): void {
    const frames = allFrames(input);
    expect(frames.length).toBeGreaterThan(0);
    const pseudocodeLength = mod.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeDefined();
        expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber as number).toBeLessThan(pseudocodeLength);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(typeof entity.metadata["row"]).toBe("number");
            expect(typeof entity.metadata["col"]).toBe("number");
        }
    });
}

describe("Damerau-Levenshtein", () => {
    it("matches the independent reference on hand-picked cases", () => {
        const cases: Array<[string, string]> = [
            ["", ""],
            ["abc", ""],
            ["", "xyz"],
            ["abc", "abc"],
            ["abcd", "abdc"],
            ["ca", "abc"],
            ["kitten", "sitting"],
            ["flaw", "lawn"],
            ["abcdef", "badcfe"],
            ["banana", "ananas"],
        ];
        for (const [a, b] of cases) {
            expect(finalDistance(a, b), `${a} vs ${b}`).toBe(reference(a, b));
        }
    });

    it("matches the reference on deterministic random string pairs", () => {
        let seed = 123456789;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        const alphabet = "abc";
        for (let trial = 0; trial < 120; trial += 1) {
            const aLength = Math.floor(rand() * 7);
            const bLength = Math.floor(rand() * 7);
            let a = "";
            let b = "";
            for (let i = 0; i < aLength; i += 1) a += alphabet[Math.floor(rand() * 3)];
            for (let i = 0; i < bLength; i += 1) b += alphabet[Math.floor(rand() * 3)];
            expect(finalDistance(a, b), `${a} vs ${b}`).toBe(reference(a, b));
        }
    });

    it("satisfies edit-distance properties", () => {
        expect(finalDistance("abcd", "abcd")).toBe(0);
        expect(finalDistance("", "")).toBe(0);
        expect(finalDistance("abcdef", "")).toBe(6);
        expect(finalDistance("", "abc")).toBe(3);
        expect(finalDistance("abcd", "abdc")).toBe(1); // one adjacent swap
        expect(finalDistance("abc", "cba")).toBe(finalDistance("cba", "abc")); // symmetry
        const d1 = finalDistance("abc", "axc");
        const d2 = finalDistance("axc", "axcxyz");
        const d3 = finalDistance("abc", "axcxyz");
        expect(d3).toBeLessThanOrEqual(d1 + d2); // triangle inequality
    });

    it("produces well-formed frames and terminates", () => {
        checkFrameShapes(mod.defaultInput);
        checkFrameShapes({ a: "", b: "abc" });
        const frames = allFrames(mod.defaultInput);
        expect(frames[frames.length - 1]?.description).toContain("Done");
        expect(frames[frames.length - 1]?.meta["distance"]).toBe(1);
    });
});
