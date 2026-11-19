/**
 * inside-algorithm.test.ts - Brute-force parse-tree enumeration check,
 * frame-shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./inside-algorithm";
import type { VisualFrame } from "@/types";

type TerminalRule = [string, string, number];
type BinaryRule = [string, string, string, number];
interface Grammar {
    terminals: TerminalRule[];
    binary: BinaryRule[];
    start: string;
}

/** Enumerate every parse tree by plain recursion, with no memoization. */
function bruteInside(grammar: Grammar, word: string, nonterminal: string, i: number, j: number): number {
    let total = 0;
    for (const [lhs, terminal, probability] of grammar.terminals) {
        if (lhs === nonterminal && i === j && word[i] === terminal) {
            total += probability;
        }
    }
    for (const [lhs, left, right, probability] of grammar.binary) {
        if (lhs !== nonterminal) {
            continue;
        }
        for (let k = i; k < j; k += 1) {
            total += probability
                * bruteInside(grammar, word, left, i, k)
                * bruteInside(grammar, word, right, k + 1, j);
        }
    }
    return total;
}

function close(a: number, b: number): boolean {
    return Math.abs(a - b) < 1e-9;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta.n).toBe(n);
        expect(frame.meta.rows).toBe(n);
        expect(frame.meta.cols).toBe(n);
    });
}

const grammar: Grammar = {
    terminals: [
        ["A", "a", 0.5],
        ["A", "b", 0.5],
        ["B", "a", 0.7],
        ["B", "b", 0.3],
    ],
    binary: [
        ["S", "A", "B", 0.6],
        ["S", "B", "A", 0.4],
    ],
    start: "S",
};

describe("InsideAlgorithm", () => {
    it("matches brute-force enumeration of all parse trees", () => {
        for (const word of ["aa", "ab", "ba", "bb", "aaa", "aab", "abba"]) {
            const frames = [...mod.run({ grammar, word })];
            checkFrames(frames, word.length);
            const last = frames[frames.length - 1];
            const expected = bruteInside(grammar, word, grammar.start, 0, word.length - 1);
            expect(close(Number(last?.meta.probability), expected)).toBe(true);
        }
    });

    it("matches brute force for every nonterminal and every span", () => {
        const word = "aba";
        const frames = [...mod.run({ grammar, word })];
        const last = frames[frames.length - 1];
        const nts = (last?.meta.nts as string).split(",");
        const inside = last?.meta.inside as number[];
        const n = word.length;
        for (let nt = 0; nt < nts.length; nt += 1) {
            for (let i = 0; i < n; i += 1) {
                for (let j = i; j < n; j += 1) {
                    const expected = bruteInside(grammar, word, nts[nt] as string, i, j);
                    const actual = inside[nt * n * n + i * n + j] as number;
                    expect(close(actual, expected)).toBe(true);
                }
            }
        }
    });

    it("handles an empty word and terminates cleanly", () => {
        const empty = [...mod.run({ grammar, word: "" })];
        expect(empty.length).toBe(1);
        expect(empty[0]?.meta.probability).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
