/** negative-hypergeometric.test.ts - Exhaustive subset enumeration check. */

import { describe, expect, it } from "vitest";
import mod from "./negative-hypergeometric";
import type { VisualFrame } from "@/types";

/** Enumerate all placements of K successes among N positions. */
function bruteForce(N: number, K: number, r: number): number[] {
    const counts = new Array<number>(N - K + 1).fill(0);
    let total = 0;
    const enumerate = (start: number, chosen: number[]) => {
        if (chosen.length === K) {
            total += 1;
            let successes = 0;
            let failures = 0;
            for (let position = 0; position < N; position += 1) {
                if (chosen.includes(position)) {
                    successes += 1;
                    if (successes === r) break;
                } else {
                    failures += 1;
                }
            }
            if (successes === r) counts[failures] = (counts[failures] ?? 0) + 1;
            return;
        }
        for (let i = start; i < N; i += 1) {
            chosen.push(i);
            enumerate(i + 1, chosen);
            chosen.pop();
        }
    };
    enumerate(0, []);
    return counts.map((c) => c / total);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    });
}

describe("Negative Hypergeometric", () => {
    it("matches exhaustive placement enumeration", () => {
        const cases = [
            { N: 10, K: 5, r: 2 },
            { N: 12, K: 6, r: 3 },
            { N: 9, K: 7, r: 4 },
            { N: 11, K: 4, r: 2 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const expected = bruteForce(input.N, input.K, input.r);
            const actual = final["pmf"] as number[];
            expect(actual.length).toBe(expected.length);
            for (let k = 0; k < expected.length; k += 1) {
                expect(Math.abs((actual[k] ?? 0) - (expected[k] ?? 0))).toBeLessThan(1e-12);
            }
            expect(Number(final["total"])).toBeCloseTo(1, 10);
            expect(Number(final["mean"])).toBeCloseTo(
                (input.r * (input.N - input.K)) / (input.K + 1), 10);
        }
    });

    it("produces a valid distribution for edge parameters", () => {
        for (const input of [{ N: 5, K: 5, r: 5 }, { N: 8, K: 2, r: 1 }]) {
            const frames = [...mod.run(input)];
            const final = frames[frames.length - 1]!.meta;
            const pmf = final["pmf"] as number[];
            expect(pmf.every((p) => p >= 0 && Number.isFinite(p))).toBe(true);
            expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
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
