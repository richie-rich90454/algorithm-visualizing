/**
 * sentencepiece-unigram.test.ts - Brute-force optimal segmentation, score agreement, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { unigramSegment } from "./sentencepiece-unigram";
import type { VisualFrame } from "@/types";

type Piece = { token: string; score: number };
type Input = { word: string; pieces?: Piece[] };

const DEFAULT_PIECES: Piece[] = [
    { token: "un", score: -1 },
    { token: "happy", score: -2 },
    { token: "happiness", score: -4 },
    { token: "ness", score: -1 },
    { token: "unhappy", score: -3 },
    { token: "hap", score: -2 },
    { token: "py", score: -1.5 },
    { token: "i", score: -1 },
    { token: "a", score: -1 },
    { token: "n", score: -1 },
    { token: "s", score: -1 },
    { token: "p", score: -1 },
    { token: "y", score: -1 },
    { token: "h", score: -1 },
    { token: "e", score: -1 },
    { token: "<unk>", score: -10 },
];

/** Exhaustive enumeration of every segmentation and its total score. */
function bruteBest(word: string, pieces: Piece[], at: number): number {
    if (at === word.length) {
        return 0;
    }
    const unknown = pieces.find((p) => p.token === "<unk>")?.score ?? -10;
    let best = unknown + bruteBest(word, pieces, at + 1);
    for (const piece of pieces) {
        if (piece.token === "<unk>" || piece.token.length === 0) {
            continue;
        }
        if (word.startsWith(piece.token, at)) {
            best = Math.max(best, piece.score + bruteBest(word, pieces, at + piece.token.length));
        }
    }
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SentencePiece Unigram", () => {
    it("finds the optimal score matching exhaustive enumeration", () => {
        for (const word of ["unhappiness", "happy", "unnest", "pennies"]) {
            const got = unigramSegment(word, DEFAULT_PIECES).score;
            expect(got).toBeCloseTo(bruteBest(word, DEFAULT_PIECES, 0), 9);
        }
    });

    it("returned pieces sum to the reported best score and cover the word", () => {
        const word = "unhappiness";
        const r = unigramSegment(word, DEFAULT_PIECES);
        const lookup = new Map(DEFAULT_PIECES.map((p) => [p.token, p.score]));
        const sum = r.tokens.reduce((total, token) => total + (lookup.get(token) ?? -10), 0);
        expect(sum).toBeCloseTo(r.score, 9);
        expect(r.tokens.length).toBeGreaterThan(0);
    });

    it("uses the unknown fallback when no piece matches", () => {
        const pieces: Piece[] = [{ token: "a", score: -1 }, { token: "<unk>", score: -8 }];
        const r = unigramSegment("az", pieces);
        expect(r.tokens).toEqual(["a", "<unk>"]);
        expect(r.score).toBeCloseTo(-9, 9);
    });

    it("emits well-formed frames that terminate", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const finalTokens = frames[frames.length - 1]?.meta["tokens"] as string[];
        expect(finalTokens.join("")).toBe("unhappiness");
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(generator.next().done).toBe(true);
        expect(count).toBe(frames.length);
    });
});
