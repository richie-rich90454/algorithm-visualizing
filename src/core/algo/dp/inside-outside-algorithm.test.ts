/**
 * inside-outside-algorithm.test.ts - Brute-force inside probability check,
 * expected-count consistency, EM monotonicity, frame-shape checks, and
 * termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./inside-outside-algorithm";
import type { VisualFrame } from "@/types";

type TerminalRule = [string, string, number];
type BinaryRule = [string, string, string, number];
interface Grammar {
    terminals: TerminalRule[];
    binary: BinaryRule[];
    start: string;
}

function bruteInside(grammar: Grammar, word: string, symbol: string, i: number, j: number): number {
    let total = 0;
    for (const [lhs, terminal, probability] of grammar.terminals) {
        if (lhs === symbol && i === j && word[i] === terminal) total += probability;
    }
    for (const [lhs, left, right, probability] of grammar.binary) {
        if (lhs !== symbol) continue;
        for (let k = i; k < j; k += 1) {
            total += probability
                * bruteInside(grammar, word, left, i, k)
                * bruteInside(grammar, word, right, k + 1, j);
        }
    }
    return total;
}

function close(a: number, b: number): boolean {
    return Math.abs(a - b) < 1e-8;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(3);
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

function frameWith(frames: VisualFrame[], mode: string): VisualFrame {
    const found = frames.find((frame) => frame.meta.mode === mode);
    expect(found, `frame with mode ${mode}`).toBeDefined();
    return found as VisualFrame;
}

describe("InsideOutsideAlgorithm", () => {
    it("matches brute-force parse enumeration for the inside probability", () => {
        for (const word of ["ab", "aa", "aba"]) {
            const frames = [...mod.run({ grammar, word, iterations: 1 })];
            checkFrames(frames, word.length);
            const insideFrame = frameWith(frames, "inside");
            const expected = bruteInside(grammar, word, grammar.start, 0, word.length - 1);
            expect(close(Number(insideFrame.meta.probability), expected)).toBe(true);
        }
    });

    it("satisfies the expected-count consistency identity for every nonterminal", () => {
        const word = "ab";
        const frames = [...mod.run({ grammar, word, iterations: 1 })];
        const insideFrame = frameWith(frames, "inside");
        const outsideFrame = frameWith(frames, "outside");
        const reFrame = frameWith(frames, "reestimate");
        const inside = insideFrame.meta.inside as number[];
        const outside = outsideFrame.meta.outside as number[];
        const nts = (insideFrame.meta.nts as string).split(",");
        const binaryCounts = reFrame.meta.binaryCounts as number[];
        const terminalCounts = reFrame.meta.terminalCounts as number[];
        const probability = Number(reFrame.meta.probability);
        const n = word.length;

        for (let nt = 0; nt < nts.length; nt += 1) {
            let term = 0;
            for (let i = 0; i < n; i += 1) {
                for (let j = i; j < n; j += 1) {
                    const idx = nt * n * n + i * n + j;
                    term += ((inside[idx] as number) * (outside[idx] as number)) / probability;
                }
            }
            let count = 0;
            grammar.binary.forEach(([lhs], index) => {
                if (lhs === nts[nt]) count += binaryCounts[index] as number;
            });
            grammar.terminals.forEach(([lhs], index) => {
                if (lhs === nts[nt]) count += terminalCounts[index] as number;
            });
            expect(close(term, count)).toBe(true);
        }
    });

    it("never decreases the word probability across EM iterations", () => {
        const frames = [...mod.run({ grammar, word: "ab", iterations: 4 })];
        const probabilities: number[] = [];
        for (const frame of frames) {
            if (["reestimate", "final"].includes(String(frame.meta.mode))) {
                probabilities.push(Number(frame.meta.probability));
            }
        }
        expect(probabilities.length).toBe(5);
        for (let i = 1; i < probabilities.length; i += 1) {
            expect(probabilities[i] as number).toBeGreaterThanOrEqual((probabilities[i - 1] as number) - 1e-9);
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
