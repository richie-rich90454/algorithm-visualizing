/** Correctness, frame shape, and termination checks for Landau-Vishkin. */
import { describe, expect, it } from "vitest";
import mod from "./landau-vishkin-alignment";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((e) => expect(e.id).toBeTruthy());
    });
}

/** Independent unit-cost Levenshtein dynamic program. */
function referenceEditDistance(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            dp[i]![j] = Math.min(
                dp[i - 1]![j]! + 1,
                dp[i]![j - 1]! + 1,
                dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
    }
    return dp[a.length]![b.length]!;
}

describe("Landau-Vishkin Alignment", () => {
    const cases: Array<[string, string]> = [
        ["", ""],
        ["", "abc"],
        ["abc", "abc"],
        ["cat", "bat"],
        ["kitten", "sitting"],
        ["GATTACA", "GATTCGA"],
        ["aaaa", "aa"],
    ];
    for (const [a, b] of cases) {
        it(`matches reference edit distance for ${a} / ${b}`, () => {
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["distance"]).toBe(referenceEditDistance(a, b));
        });
    }

    it("agrees with the reference on deterministic random pairs", () => {
        let seed = 12345;
        const rnd = (): number => {
            seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        const alphabet = "abcd";
        for (let t = 0; t < 20; t += 1) {
            const a = Array.from({ length: 1 + Math.floor(rnd() * 7) }, () => alphabet[Math.floor(rnd() * 4)]).join("");
            const b = Array.from({ length: 1 + Math.floor(rnd() * 7) }, () => alphabet[Math.floor(rnd() * 4)]).join("");
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["distance"]).toBe(referenceEditDistance(a, b));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
