/**
 * beam-search-decoding.test.ts - Exhaustive enumeration cross-check for every
 * decoding step, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./beam-search-decoding";
import type { VisualFrame } from "@/types";

interface Input {
    vocab: string[];
    logProbs: number[][];
    length: number;
    width: number;
}

function checkFrames(frames: VisualFrame[], width: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(width * 2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Enumerate every sequence of a given length and return the best `count`. */
function exhaustive(input: Input, length: number, count: number): Array<{ tokens: number[]; score: number }> {
    const V = input.vocab.length;
    const all: Array<{ tokens: number[]; score: number }> = [];
    let frontier: number[][] = [[]];
    for (let t = 0; t < length; t += 1) {
        const next: number[][] = [];
        for (const tokens of frontier) {
            const last = tokens[tokens.length - 1];
            const row = last === undefined ? (input.logProbs[0] ?? []) : (input.logProbs[last + 1] ?? []);
            for (let token = 0; token < V; token += 1) {
                next.push([...tokens, token]);
            }
        }
        frontier = next;
    }
    for (const tokens of frontier) {
        let score = 0;
        for (let i = 0; i < tokens.length; i += 1) {
            const last = i === 0 ? undefined : tokens[i - 1];
            const row = last === undefined ? (input.logProbs[0] ?? []) : (input.logProbs[last + 1] ?? []);
            score += row[tokens[i] ?? 0] ?? 0;
        }
        all.push({ tokens, score });
    }
    all.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        for (let i = 0; i < Math.min(a.tokens.length, b.tokens.length); i += 1) {
            if (a.tokens[i] !== b.tokens[i]) {
                return (a.tokens[i] ?? 0) - (b.tokens[i] ?? 0);
            }
        }
        return a.tokens.length - b.tokens.length;
    });
    return all.slice(0, count);
}

describe("Beam Search Decoding", () => {
    it("matches exhaustive enumeration at every decoding step", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.width);

        for (let step = 1; step <= input.length; step += 1) {
            const frame = frames[step];
            const best = exhaustive(input, step, input.width);
            const seqs = frame?.meta["beamSeqs"] as string[];
            const scores = frame?.meta["beamScores"] as number[];
            expect(seqs.length).toBe(best.length);
            best.forEach((candidate, i) => {
                const expected = candidate.tokens.map((t) => input.vocab[t] ?? "?").join(" ");
                expect(seqs[i]).toBe(expected);
                expect(scores[i]).toBeCloseTo(candidate.score, 8);
            });
        }

        const final = frames[frames.length - 1]?.meta;
        const best = exhaustive(input, input.length, input.width);
        expect(final?.["bestSeq"]).toBe(best[0]?.tokens.map((t) => input.vocab[t] ?? "?").join(" "));
        expect(Number(final?.["bestScore"])).toBeCloseTo(best[0]?.score ?? 0, 8);
    });

    it("agrees with exhaustive search over several widths and tables", () => {
        const tables = [
            [
                [-0.1, -1.2, -2.0],
                [-0.7, -0.2, -1.5],
                [-0.3, -0.9, -0.4],
                [-1.0, -0.1, -1.8],
            ],
            [
                [-0.2, -1.1, -1.4],
                [-3, 0, -3],
                [-3, -3, 0],
                [-0.5, -0.3, -0.1],
            ],
        ];
        for (const logProbs of tables) {
            for (const width of [1, 2, 3]) {
                const input: Input = { vocab: ["x", "y", "z"], logProbs, length: 3, width };
                const frames = [...mod.run(input)];
                checkFrames(frames, width);
                for (let step = 1; step <= input.length; step += 1) {
                    const frame = frames[step];
                    const best = exhaustive(input, step, width);
                    const seqs = frame?.meta["beamSeqs"] as string[];
                    const scores = frame?.meta["beamScores"] as number[];
                    expect(seqs.length).toBe(best.length);
                    best.forEach((candidate, i) => {
                        expect(seqs[i]).toBe(candidate.tokens.map((t) => input.vocab[t] ?? "?").join(" "));
                        expect(scores[i]).toBeCloseTo(candidate.score, 8);
                    });
                }
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["converged"]).toBe(true);
            }
        }
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
