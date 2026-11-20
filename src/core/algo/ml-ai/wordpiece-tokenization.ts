/**
 * wordpiece-tokenization.ts - WordPiece Greedy Subword Tokenization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * WordPiece breaks a word into the longest subword pieces available in its
 * vocabulary. A piece that does not start the word carries a leading double
 * hash marker, so the same learned vocabulary can be reused at any position.
 * Starting at each character, the tokenizer tries the longest matching piece
 * first and falls back to an unknown token when nothing matches.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L^2) for a word of length L with a hash vocabulary lookup
 *   Space: O(L) for the emitted token list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars are the tokens emitted so far, revealed one token at a time.
 *   - Metadata carries the current word, the token list, and the vocabulary.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface WordPieceInput {
    words?: string[];
    vocab?: string[];
}

/** Greedy longest-match-first WordPiece tokenization of one word. */
export function wordPieceTokenize(word: string, vocab: Set<string>): string[] {
    const tokens: string[] = [];
    let pos = 0;
    while (pos < word.length) {
        let chosen: { token: string; end: number } | undefined;
        for (let end = word.length; end > pos; end -= 1) {
            const piece = word.slice(pos, end);
            const candidate = pos === 0 ? piece : `##${piece}`;
            if (vocab.has(candidate)) {
                chosen = { token: candidate, end };
                break;
            }
        }
        if (chosen) {
            tokens.push(chosen.token);
            pos = chosen.end;
        } else {
            tokens.push("[UNK]");
            pos += 1;
        }
    }
    return tokens;
}

function tokenBars(tokens: string[], revealed: number): VisualEntity[] {
    return tokens.map((token, index) => ({
        id: `token-${index}`,
        type: "bar" as const,
        label: token,
        value: index + 1,
        state: (index < revealed ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, token },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as WordPieceInput | null) ?? {};
    const words: string[] = Array.isArray(task.words) && task.words.length > 0
        ? task.words.map((word) => String(word).toLowerCase())
        : ["playing", "player", "unhappy", "hugging"];
    const baseVocab: string[] = Array.isArray(task.vocab) && task.vocab.length > 0
        ? task.vocab.map((token) => String(token))
        : [
              "play", "un", "hug", "happy", "##ing", "##er", "##y", "##p", "##n", "##g",
              "##a", "##e", "##i", "##h", "##u", "##l", "##o", "##r", "##s", "##t",
              ..."abcdefghijklmnopqrstuvwxyz".split(""),
              "[UNK]",
          ];
    const vocab = new Set(baseVocab);
    const allTokens: string[] = [];

    let step = 0;
    for (const word of words) {
        const tokens = wordPieceTokenize(word, vocab);
        for (let k = 1; k <= tokens.length; k += 1) {
            const shown = tokens.slice(0, k);
            yield {
                stepNumber: step,
                entities: tokenBars(shown, k),
                edges: [],
                description: `Word "${word}": emitted ${k} of ${tokens.length} subword pieces; last piece "${tokens[k - 1]}".`,
                codeLineNumber: k === 1 ? 1 : 3,
                layout: "array",
                meta: {
                    word,
                    tokens: shown,
                    vocabSize: vocab.size,
                    phase: "tokenizing",
                },
            };
            step += 1;
        }
        allTokens.push(...tokens);
    }

    yield {
        stepNumber: step,
        entities: tokenBars(allTokens, allTokens.length),
        edges: [],
        description: `Done: tokenized ${words.length} words into ${allTokens.length} WordPiece subword tokens.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            words,
            tokens: allTokens,
            vocabSize: vocab.size,
            phase: "done",
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "WordPiece keeps a vocabulary of word pieces, some of which are marked as continuations with a double hash. To tokenize a word it repeatedly takes the longest piece that fits at the current position, using the continuation form once it is past the first character. This lets common words be one or two pieces while rare words can always be split into single characters.",
        invariants: [
            "The first piece of a word never carries the continuation marker.",
            "Every later piece is looked up with the continuation marker prepended.",
            "Pieces are chosen greedily by maximum length, with an unknown fallback.",
        ],
        correctness:
            "At each position the loop scans candidate ends from longest to shortest, so the first vocabulary match is the longest available piece at that position. For positions after zero only continuation-marked pieces are accepted, which is the WordPiece convention. Concatenating the emitted pieces after stripping markers reproduces the original word exactly whenever every character is coverable, proving the tokenizer does not skip or duplicate input.",
        complexityRationale:
            "For a word of length L each position tries up to L candidate pieces and each hash lookup is constant time on average, giving O(L squared) worst case. The emitted token list has at most L entries, so space is O(L).",
        uses: [
            "Subword tokenization in BERT-style language models",
            "Handling rare and unseen words with a fixed vocabulary",
            "Compact multilingual text representation",
        ],
        references: [
            "Schuster and Nakajima, Japanese and Korean Voice Search, 2012",
            "Devlin et al., BERT: Pre-training of Deep Bidirectional Transformers, 2019",
        ],
        workedExample:
            "With pieces play, ##ing, and single letters, the word playing starts at position zero and matches play, then the remaining ing is looked up as ##ing. The word becomes the two tokens play and ##ing, which reconstruct to playing when the marker is stripped.",
    },
    id: "wordpiece-tokenization",
    name: "WordPiece Tokenization",
    category: "ml-ai",
    complexity: { time: "O(L^2)", space: "O(L)" },
    defaultInput: { words: ["playing", "player", "unhappy", "hugging"] },
    visualType: "array",
    run,
    pseudocode: [
        "build a hash set from the subword vocabulary",
        "for each word start at the first character position",
        "try the longest piece that matches at this position",
        "use the continuation form past the first character",
        "emit the match and advance past it",
        "on no match emit an unknown token and advance one character",
        "done: report all emitted subword pieces",
    ],
};

export default module;
