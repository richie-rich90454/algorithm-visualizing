/**
 * bpe-tokenization.ts - Byte-Pair Encoding Merge (Teachable Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Byte-pair encoding builds a subword vocabulary by repeatedly merging the
 * most frequent adjacent pair of symbols in a weighted corpus. This module
 * implements exactly that teachable loop: count adjacent-pair frequencies
 * weighted by word frequency, pick the highest pair with a deterministic
 * tie-break, merge every occurrence, and repeat until the vocabulary target
 * is reached. The full tokenizer training pipeline is out of scope.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * total_symbols) for m merges over the current corpus
 *   Space: O(total_symbols + vocabulary) for symbols and the merge list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame is the current corpus as a grid of word rows and symbol
 *     columns; the pair chosen for the next merge is highlighted.
 *   - The merge, its frequency, and the vocabulary are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CorpusWord { word: string; freq: number }
interface BpeInput { corpus?: CorpusWord[]; vocabTarget?: number }

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

function bestPair(pairs: Map<string, { a: string; b: string; freq: number }>): { a: string; b: string; freq: number; key: string } | undefined {
    let best: { a: string; b: string; freq: number; key: string } | undefined;
    for (const [key, entry] of pairs) {
        if (!best || entry.freq > best.freq || (entry.freq === best.freq && key < best.key)) {
            best = { ...entry, key };
        }
    }
    return best;
}

function makeCells(corpus: string[][], pair: { a: string; b: string } | undefined): { entities: VisualEntity[]; cols: number } {
    const rows = corpus.length;
    const cols = corpus.reduce((max, symbols) => Math.max(max, symbols.length), 0);
    const entities: VisualEntity[] = [];
    for (let row = 0; row < rows; row += 1) {
        const symbols = corpus[row] ?? [];
        for (let col = 0; col < cols; col += 1) {
            const symbol = symbols[col] ?? "";
            const marked = Boolean(pair && symbols[col] === pair.a && symbols[col + 1] === pair.b)
                || Boolean(pair && symbols[col - 1] === pair.a && symbols[col] === pair.b);
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: symbol === "" ? " " : symbol,
                value: symbol,
                state: (marked ? "highlight" : symbol === "" ? "unvisited" : "sorted") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, symbol },
            });
        }
    }
    return { entities, cols };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BpeInput | null) ?? {};
    const source: CorpusWord[] = Array.isArray(task.corpus) && task.corpus.length > 0
        ? task.corpus.map((w) => ({ word: String(w.word), freq: Math.max(1, Math.trunc(w.freq)) }))
        : [
              { word: "low", freq: 5 },
              { word: "lower", freq: 2 },
              { word: "newest", freq: 3 },
              { word: "widest", freq: 2 },
          ];
    const corpus = source.map((w) => [...w.word]);
    const initialVocab = new Set(corpus.flat());
    const vocabTarget = Math.max(initialVocab.size, typeof task.vocabTarget === "number" ? Math.trunc(task.vocabTarget) : 14);

    let step = 0;
    let chosen: { a: string; b: string; freq: number; key: string } | undefined;
    const emit = (pair: { a: string; b: string } | undefined, description: string, line: number, phase: string) => {
        const view = makeCells(corpus, pair);
        const frame: VisualFrame = {
            stepNumber: step,
            entities: view.entities,
            edges: [],
            description,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                rows: corpus.length,
                cols: view.cols,
                phase,
                vocabTarget,
                vocabSize: initialVocab.size,
                vocabulary: [...initialVocab].sort(),
                pair: pair ? [pair.a, pair.b] : [],
                pairFreq: chosen?.freq ?? 0,
                tokenCount: corpus.reduce((s, symbols) => s + symbols.length, 0),
                corpus: corpus.map((symbols) => symbols.join("")),
            },
        };
        step += 1;
        return frame;
    };

    yield emit(undefined, `Start with ${corpus.length} weighted words and ${initialVocab.size} single-character symbols.`, 0, "start");

    while (initialVocab.size < vocabTarget) {
        const pairs = countPairs(corpus);
        chosen = bestPair(pairs);
        if (!chosen) break;
        yield emit(chosen, `Most frequent adjacent pair is "${chosen.a}${chosen.b}" with frequency ${chosen.freq}.`, 2, "select");
        for (const symbols of corpus) {
            const merged: string[] = [];
            for (let i = 0; i < symbols.length; i += 1) {
                if (symbols[i] === chosen.a && symbols[i + 1] === chosen.b) {
                    merged.push(chosen.a + chosen.b);
                    i += 1;
                } else {
                    merged.push(symbols[i] ?? "");
                }
            }
            symbols.splice(0, symbols.length, ...merged);
        }
        initialVocab.add(chosen.a + chosen.b);
        yield emit(undefined, `Merged "${chosen.a}${chosen.b}" everywhere; vocabulary now has ${initialVocab.size} symbols.`, 4, "merge");
    }

    const finalPairs = countPairs(corpus);
    yield emit(undefined, `Done: ${initialVocab.size} symbols, ${finalPairs.size} adjacent pair types remaining.`, 6, "done");
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Byte-pair encoding starts with single characters and repeatedly joins the adjacent pair that appears most often in the training text, weighted by how often each word occurs. Each join creates a new subword symbol, so the vocabulary grows one symbol at a time. The result is a compact set of pieces that can encode rare words without a symbol for every full word.",
        invariants: [
            "Every merge joins two adjacent symbols that occur next to each other in the corpus.",
            "The chosen pair has the maximum weighted frequency, with lexical order breaking ties.",
            "Each merge adds exactly one new symbol to the vocabulary.",
        ],
        correctness:
            "Counting adjacent pairs over every word and weighting each word by its frequency gives the true corpus frequency of each pair. Selecting the maximum, with a fixed lexical tie-break, makes the choice deterministic. The merge pass scans each word once and replaces every adjacent occurrence with the concatenated symbol, so no pair occurrence is skipped and the remaining symbols still reproduce the original text when concatenated.",
        complexityRationale:
            "Each of the m merges scans all remaining symbols to count pairs and again to apply the merge, so the work is O(m times total symbols). The stored state is the corpus symbols plus the vocabulary, which is O(total symbols plus vocabulary).",
        uses: [
            "Subword tokenization for transformer language models",
            "Handling rare and unseen words in machine translation",
            "Compact vocabularies for multilingual text processing",
        ],
        references: [
            "Gage, A New Algorithm for Data Compression, 1994",
            "Sennrich, Haddow and Birch, Neural Machine Translation of Rare Words with Subword Units, 2016",
        ],
        workedExample:
            "In the corpus low times five and lower times two, the pair l-o appears seven times and o-w appears seven times. With the lexical tie-break the pair l-o merges first into lo, lowering the total symbol count while adding the single new vocabulary entry lo.",
    },
    id: "bpe-tokenization",
    name: "Byte-Pair Encoding Merge (Teachable Core)",
    category: "ml-ai",
    complexity: { time: "O(m * total_symbols)", space: "O(total_symbols + vocabulary)" },
    defaultInput: {
        corpus: [
            { word: "low", freq: 5 },
            { word: "lower", freq: 2 },
            { word: "newest", freq: 3 },
            { word: "widest", freq: 2 },
        ],
        vocabTarget: 14,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "split each weighted word into its initial characters",
        "build the vocabulary from those characters",
        "count every adjacent pair weighted by word frequency",
        "choose the highest frequency pair with a lexical tie-break",
        "replace every occurrence of the pair with a merged symbol",
        "add the merged symbol to the vocabulary",
        "repeat until the vocabulary target is reached",
        "done: report the vocabulary and the merged corpus",
    ],
};

export default module;
