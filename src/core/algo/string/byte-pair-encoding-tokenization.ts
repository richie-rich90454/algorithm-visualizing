/**
 * byte-pair-encoding-tokenization.ts – BPE Tokenization.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n) per merge", space: "O(n)"
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

function tx(t: string, st: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(t).map((c) => {
        const i = Number((c.metadata as Record<string, unknown>)["index"]);
        return { ...c, state: st.get(i) ?? "idle" };
    });
}
function stAt(pos: number[], s: EntityState): Map<number, EntityState> {
    return new Map(pos.map((p) => [p, s] as [number, EntityState]));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { text?: string } | null) ?? {};
    const text = t.text ?? "aaabdaaabac";
    let step = 0;
    const F = (
        entities: VisualEntity[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber,
        layout: "text",
        meta: { comparisons: 0, matches: [], ...meta },
    });
    yield F(tx(text), `BPE tokenize "${text}" (2 merges).`, 0);
    step += 1;
    let toks = text.split("");
    yield F(tx(toks.join(" ")), `Start: ${toks.length} char tokens.`, 1);
    step += 1;
    const merges: string[] = [];
    for (let round = 0; round < 2; round += 1) {
        const freq = new Map<string, number>();
        for (let i = 0; i + 1 < toks.length; i += 1) {
            const p = `${toks[i]}+${toks[i + 1]}`;
            freq.set(p, (freq.get(p) ?? 0) + 1);
        }
        let best = "",
            bn = 0;
        for (const [p, n] of freq)
            if (n > bn) {
                bn = n;
                best = p;
            }
        if (!best) break;
        merges.push(best);
        const [x, y] = best.split("+");
        const next: string[] = [];
        for (let i = 0; i < toks.length; i += 1) {
            if (toks[i] === x && toks[i + 1] === y) {
                next.push((x as string) + (y as string));
                i += 1;
            } else next.push(toks[i] as string);
        }
        toks = next;
        yield F(tx(toks.join(" ")), `Merge "${best}" (×${bn}): ${toks.length} tokens.`, 2, {
            toks: [...toks],
        });
        step += 1;
    }
    yield F(tx(toks.join(" ")), `Tokens: [${toks.join(" | ")}].`, 3, { toks });
    step += 1;
    yield F(
        tx(toks.join(" ")),
        `BPE complete: ${toks.length} tokens after ${merges.length} merges.`,
        4,
        { toks, merges },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Byte-pair encoding builds a vocabulary by repeatedly merging the most frequent adjacent pair of tokens. Starting from single characters, each merge replaces every occurrence of the winning pair with a new token, shrinking the sequence and capturing common patterns such as \"th\" or \"ing\".",
        "invariants": [
            "Tokens are always contiguous substrings of the original text and concatenate back to it.",
            "Each merge targets the most frequent adjacent pair in the current token sequence.",
            "Every merge strictly reduces or preserves the token count."
        ],
        "correctness": "Merging the most frequent pair everywhere at once keeps the token sequence concatenating to the original text, and the chosen pair is by definition the best local gain at that step. Repeating merges greedily builds a vocabulary in which frequent substrings become single tokens, which is the goal of subword tokenization.",
        "complexityRationale": "Counting adjacent pairs and applying a merge each scan the current token list once, so one merge costs O(n) for text length n. With M merges the total is O(Mn), reported as O(n) per merge; space is O(n) for the tokens and frequency map.",
        "uses": [
            "Subword tokenization in language models and GPT-style tokenizers",
            "Compressing text with repeated patterns",
            "Building vocabularies for low-resource languages"
        ],
        "references": [
            "Gage, A New Algorithm for Data Compression, 1994",
            "Sennrich et al., Neural Machine Translation of Rare Words with Subword Units, 2016"
        ],
        "workedExample": "For \"aaabdaaabac\" the most frequent pair is \"aa\"; merging non-overlapping copies gives roughly [aa, a, b, d, aa, a, b, a, c]. The next merge combines \"aa\" with the following \"a\" into \"aaa\", producing [aaa, b, d, aaa, b, a, c] after two merges."
    },
    id: "byte-pair-encoding-tokenization",
    name: "BPE Tokenization",
    category: "string",
    complexity: { time: "O(n) per merge", space: "O(n)" },
    defaultInput: { text: "aaabdaaabac" },
    visualType: "text",
    run,
    pseudocode: [
        "split text into single-character tokens",
        "count adjacent pair frequencies across tokens",
        "select most frequent pair as next merge",
        "merge all occurrences into new token",
        "repeat merging until target vocabulary reached",
        "record merge order and final token list",
        "report tokenized output and merge history",
    ],
};

export default module;
