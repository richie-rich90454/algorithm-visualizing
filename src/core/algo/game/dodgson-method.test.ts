/**
 * dodgson-method.test.ts - Swap-cost correctness against an independent
 * ballot-rewriting brute force, plus frame-shape and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./dodgson-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        const seen = new Set(frame.entities.map((e) => e.id));
        expect(seen.size).toBe(frame.entities.length);
    }
}

/** Independent reference: rewrite each ballot, then recompute pairwise wins. */
function referenceScore(ballots: number[][], m: number, c: number): number {
    const v = ballots.length;
    if (v === 0) {
        return 0;
    }
    const majority = Math.floor(v / 2) + 1;
    const options = ballots.map((ballot) => {
        const pos = ballot.indexOf(c);
        return pos < 0 ? [0] : Array.from({ length: pos + 1 }, (_, k) => k);
    });
    let best = Infinity;
    const search = (index: number, total: number, rewritten: number[][]): void => {
        if (total >= best) {
            return;
        }
        if (index === options.length) {
            for (let opponent = 0; opponent < m; opponent += 1) {
                if (opponent === c) {
                    continue;
                }
                let wins = 0;
                for (const ballot of rewritten) {
                    const pc = ballot.indexOf(c);
                    const po = ballot.indexOf(opponent);
                    if (pc >= 0 && po >= 0 && pc < po) {
                        wins += 1;
                    }
                }
                if (wins < majority) {
                    return;
                }
            }
            best = total;
            return;
        }
        for (const k of options[index] ?? []) {
            const ballot = [...(ballots[index] ?? [])];
            const pos = ballot.indexOf(c);
            if (pos >= 0 && k > 0) {
                ballot.splice(pos, 1);
                ballot.splice(pos - k, 0, c);
            }
            rewritten.push(ballot);
            search(index + 1, total + k, rewritten);
            rewritten.pop();
        }
    };
    search(0, 0, []);
    return best === Infinity ? v * m : best;
}

function reference(ballots: number[][], m: number): { scores: number[]; winners: number[] } {
    const scores = Array.from({ length: m }, (_, c) => referenceScore(ballots, m, c));
    const best = Math.min(...scores);
    const winners = scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
    return { scores, winners };
}

describe("Dodgson's Method", () => {
    it("matches the independent brute force on the default and random elections", () => {
        let seed = 17;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        const cases: Array<{ ballots: number[][]; candidates: number }> = [
            mod.defaultInput as { ballots: number[][]; candidates: number },
            { ballots: [[0, 1, 2], [0, 2, 1], [1, 0, 2], [2, 1, 0]], candidates: 3 },
        ];
        for (let trial = 0; trial < 20; trial += 1) {
            const m = 3 + Math.floor(rand() * 2);
            const ballots: number[][] = [];
            const count = 3 + Math.floor(rand() * 3);
            for (let b = 0; b < count; b += 1) {
                const order = Array.from({ length: m }, (_, k) => k).sort(() => rand() - 0.5);
                ballots.push(order);
            }
            cases.push({ ballots, candidates: m });
        }
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(input.ballots, input.candidates);
            expect(final?.["scores"]).toEqual(expected.scores);
            expect(final?.["winners"]).toEqual(expected.winners);
        }
    });

    it("gives a Condorcet winner a score of zero and elects it alone", () => {
        let seed = 91;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        let checked = 0;
        for (let trial = 0; trial < 60 && checked < 8; trial += 1) {
            const m = 3;
            const ballots = Array.from({ length: 5 }, () =>
                Array.from({ length: m }, (_, k) => k).sort(() => rand() - 0.5),
            );
            const wins = Array.from({ length: m }, () => new Array<number>(m).fill(0));
            for (const ballot of ballots) {
                for (let i = 0; i < m; i += 1) {
                    for (let j = 0; j < m; j += 1) {
                        if (ballot.indexOf(i) < ballot.indexOf(j)) {
                            wins[i]![j] = (wins[i]![j] ?? 0) + 1;
                        }
                    }
                }
            }
            const condorcet = Array.from({ length: m }, (_, c) =>
                Array.from({ length: m }, (_, o) => o === c || (wins[c]![o] ?? 0) > (wins[o]![c] ?? 0)).every(Boolean)
                    ? c
                    : -1,
            ).find((c) => c >= 0);
            if (condorcet === undefined) {
                continue;
            }
            const frames = [...mod.run({ ballots, candidates: m })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect((final?.["scores"] as number[])[condorcet]).toBe(0);
            expect(final?.["winners"]).toEqual([condorcet]);
            checked += 1;
        }
        expect(checked).toBeGreaterThan(0);
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
