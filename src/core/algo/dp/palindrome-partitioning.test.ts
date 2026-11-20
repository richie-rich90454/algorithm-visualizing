import { describe, expect, it } from "vitest";
import mod from "./palindrome-partitioning";

/** Brute force: try every subset of cut positions and keep all-palindrome pieces. */
function bruteForce(s: string): string[] {
    const n = s.length;
    if (n === 0) {
        return [""];
    }
    const result: string[] = [];
    for (let mask = 0; mask < 1 << (n - 1); mask += 1) {
        const pieces: string[] = [];
        let start = 0;
        for (let gap = 0; gap < n - 1; gap += 1) {
            if (mask & (1 << gap)) {
                pieces.push(s.slice(start, gap + 1));
                start = gap + 1;
            }
        }
        pieces.push(s.slice(start));
        if (pieces.every((p) => p === [...p].reverse().join(""))) {
            result.push(pieces.join("|"));
        }
    }
    return result.sort();
}

function framesFor(s: string) {
    return [...mod.run({ s })];
}

describe("PalindromePartitioning", () => {
    it("enumerates exactly the same partitions as brute force", () => {
        for (const s of ["", "a", "aa", "aab", "abba", "abc", "aaaa", "racecar"]) {
            const frames = framesFor(s);
            const last = frames[frames.length - 1];
            const got = (last?.meta.partitions as string[] | undefined) ?? [];
            expect(last?.meta.count, `s=${s}`).toBe(got.length);
            expect([...got].sort(), `s=${s}`).toEqual(bruteForce(s));
        }
    });

    it("emits well-formed text frames with sequential step numbers", () => {
        const frames = framesFor("aab");
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.layout).toBe("text");
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect((mod.pseudocode ?? []).length).toBeGreaterThan(frame.codeLineNumber ?? 0);
            expect(typeof frame.meta.length).toBe("number");
            if (index > 0) {
                expect(frame.entities.length).toBe(3);
                for (const entity of frame.entities) {
                    expect(entity.type).toBe("character");
                }
            }
        });
    });

    it("terminates cleanly on an empty string", () => {
        const generator = mod.run({ s: "" });
        let count = 0;
        let result = generator.next();
        while (!result.done) {
            count += 1;
            result = generator.next();
        }
        expect(count).toBe(1);
    });
});
