/**
 * kemeny-method.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./kemeny-method";
import type { VisualFrame } from "@/types";

interface Input {
    candidates: string[];
    ballots: number[][];
}

/** Independent score: count every voter pair whose order contradicts the ranking. */
function directScore(perm: number[], ballots: number[][]): number {
    const pos: number[] = [];
    perm.forEach((c, i) => {
        pos[c] = i;
    });
    let total = 0;
    for (const ballot of ballots) {
        for (let i = 0; i < ballot.length; i += 1) {
            for (let j = i + 1; j < ballot.length; j += 1) {
                const a = ballot[i] as number;
                const b = ballot[j] as number;
                if ((pos[a] as number) > (pos[b] as number)) {
                    total += 1;
                }
            }
        }
    }
    return total;
}

/** Independent permutation generator using the factorial number system. */
function allPerms(m: number): number[][] {
    const facts = [1];
    for (let i = 1; i <= m; i += 1) {
        facts[i] = (facts[i - 1] as number) * i;
    }
    const out: number[][] = [];
    for (let n = 0; n < (facts[m] as number); n += 1) {
        let x = n;
        const avail = Array.from({ length: m }, (_, i) => i);
        const perm: number[] = [];
        for (let k = m; k >= 1; k -= 1) {
            const f = facts[k - 1] as number;
            const idx = Math.floor(x / f);
            x %= f;
            perm.push(avail.splice(idx, 1)[0] as number);
        }
        out.push(perm);
    }
    return out;
}

function checkFrames(frames: VisualFrame[], m: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(m);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Kemeny-Young Method", () => {
    it("finds the minimum-disagreement ranking on several instances", () => {
        const cases: Input[] = [
            {
                candidates: ["A", "B", "C"],
                ballots: [
                    [0, 1, 2],
                    [1, 2, 0],
                    [2, 0, 1],
                ],
            },
            {
                candidates: ["A", "B", "C", "D"],
                ballots: [
                    [0, 1, 2, 3],
                    [1, 2, 3, 0],
                    [2, 0, 1, 3],
                    [0, 2, 1, 3],
                    [3, 2, 1, 0],
                ],
            },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.candidates.length);
            const final = frames[frames.length - 1]?.meta;
            const reported = Number(final?.["bestScore"]);

            let brute = Infinity;
            for (const perm of allPerms(input.candidates.length)) {
                brute = Math.min(brute, directScore(perm, input.ballots));
            }
            expect(reported).toBe(brute);

            // Local optimality: no adjacent swap in the reported order lowers the score.
            const best = (final?.["bestRanking"] as string)
                .split(" > ")
                .map((name) => input.candidates.indexOf(name));
            const local = directScore(best, input.ballots);
            for (let i = 0; i + 1 < best.length; i += 1) {
                const swapped = [...best];
                [swapped[i], swapped[i + 1]] = [swapped[i + 1] as number, swapped[i] as number];
                expect(directScore(swapped, input.ballots)).toBeGreaterThanOrEqual(local);
            }
        }
    });

    it("ranks a clear Condorcet order first with zero disagreements", () => {
        const input: Input = {
            candidates: ["A", "B", "C"],
            ballots: [
                [0, 1, 2],
                [0, 1, 2],
                [0, 1, 2],
            ],
        };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["bestScore"]).toBe(0);
        expect(final?.["bestRanking"]).toBe("A > B > C");
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
