/**
 * bpe-tokenization.test.ts - Independent BPE merge reference, pair maximality,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./bpe-tokenization";
import type { VisualFrame } from "@/types";

interface CorpusWord { word: string; freq: number }

function countPairs(corpus: string[][]): Map<string, { a: string; b: string; freq: number }> {
    const pairs = new Map<string, { a: string; b: string; freq: number }>();
    for (const symbols of corpus) {
        for (let i = 0; i + 1 < symbols.length; i += 1) {
            const a = symbols[i] ?? "";
            const b = symbols[i + 1] ?? "";
            const key = `${a}\u0000${b}`;
            const entry = pairs.get(key) ?? { a, b, freq: 0 };
            entry.freq += 1;
            pairs.set(key, entry);
        }
    }
    return pairs;
}

function bestPair(pairs: Map<string, { a: string; b: string; freq: number }>) {
    let best: { a: string; b: string; freq: number; key: string } | undefined;
    for (const [key, entry] of pairs) {
        if (!best || entry.freq > best.freq || (entry.freq === best.freq && key < best.key)) {
            best = { ...entry, key };
        }
    }
    return best;
}

function reference(corpusIn: CorpusWord[], vocabTarget: number) {
    const corpus = corpusIn.map((w) => [...w.word]);
    const vocab = new Set(corpus.flat());
    const merges: Array<{ a: string; b: string; freq: number }> = [];
    const pairHistory: Array<Map<string, { a: string; b: string; freq: number }>> = [];
    while (vocab.size < vocabTarget) {
        const pairs = countPairs(corpus);
        const best = bestPair(pairs);
        if (!best) break;
        pairHistory.push(pairs);
        merges.push({ a: best.a, b: best.b, freq: best.freq });
        for (const symbols of corpus) {
            const merged: string[] = [];
            for (let i = 0; i < symbols.length; i += 1) {
                if (symbols[i] === best.a && symbols[i + 1] === best.b) {
                    merged.push((symbols[i] ?? "") + (symbols[i + 1] ?? ""));
                    i += 1;
                } else merged.push(symbols[i] ?? "");
            }
            symbols.splice(0, symbols.length, ...merged);
        }
        vocab.add(best.a + best.b);
    }
    return { corpus, vocab: [...vocab].sort(), merges, pairHistory };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(Number(frame.meta["rows"]) * Number(frame.meta["cols"]));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Array.isArray(frame.meta["corpus"])).toBe(true);
    });
}

describe("BytePairEncoding", () => {
    const corpus: CorpusWord[] = [
        { word: "low", freq: 5 },
        { word: "lower", freq: 2 },
        { word: "newest", freq: 3 },
        { word: "widest", freq: 2 },
    ];

    it("matches an independent BPE merge sequence on several corpora", () => {
        const cases = [
            { corpus, vocabTarget: 14 },
            { corpus: [{ word: "abab", freq: 3 }, { word: "abac", freq: 2 }, { word: "baba", freq: 4 }], vocabTarget: 9 },
            { corpus: [{ word: "aaa", freq: 2 }, { word: "aa", freq: 5 }], vocabTarget: 5 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const expected = reference(testCase.corpus, testCase.vocabTarget);
            const final = frames[frames.length - 1];
            expect(final?.meta["vocabulary"]).toEqual(expected.vocab);
            expect(final?.meta["corpus"]).toEqual(expected.corpus.map((s) => s.join("")));
            const selectFrames = frames.filter((f) => f.meta["phase"] === "select");
            expect(selectFrames.length).toBe(expected.merges.length);
            selectFrames.forEach((frame, i) => {
                const pair = frame.meta["pair"] as string[];
                expect(pair).toEqual([expected.merges[i]?.a, expected.merges[i]?.b]);
                expect(Number(frame.meta["pairFreq"])).toBe(expected.merges[i]?.freq);
            });
        }
    });

    it("always chooses a maximum-frequency adjacent pair", () => {
        const frames = [...mod.run({ corpus, vocabTarget: 14 })];
        const history = reference(corpus, 14).pairHistory;
        const selectFrames = frames.filter((f) => f.meta["phase"] === "select");
        selectFrames.forEach((frame, i) => {
            const pairs = history[i];
            const chosen = frame.meta["pair"] as string[];
            const key = `${chosen[0]}\u0000${chosen[1]}`;
            const maxFreq = Math.max(...[...(pairs?.values() ?? [])].map((e) => e.freq));
            expect(pairs?.get(key)?.freq).toBe(maxFreq);
            const lexicalMin = [...(pairs?.entries() ?? [])]
                .filter(([, e]) => e.freq === maxFreq)
                .map(([k]) => k)
                .sort()[0];
            expect(key).toBe(lexicalMin);
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
