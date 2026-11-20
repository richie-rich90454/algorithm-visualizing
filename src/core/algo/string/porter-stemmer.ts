/**
 * porter-stemmer.ts – Porter Stemmer.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n)", space: "O(1)"
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

function stem(w: string): string {
    let s = w.toLowerCase();
    if (s.endsWith("sses")) s = s.slice(0, -2);
    else if (s.endsWith("ies")) s = s.slice(0, -2);
    else if (s.endsWith("ss")) s = s;
    else if (s.endsWith("s") && s.length > 2) s = s.slice(0, -1);
    if (s.endsWith("eed") && s.length > 4) s = s.slice(0, -1);
    else if (s.endsWith("ed") && /[aeiou]/.test(s.slice(0, -2))) s = s.slice(0, -2);
    else if (s.endsWith("ing") && /[aeiou]/.test(s.slice(0, -3))) s = s.slice(0, -3);
    return s;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { word?: string } | null) ?? {};
    const word = t.word ?? "caresses";
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
    yield F(tx(word), `Porter stem("${word}").`, 0);
    step += 1;
    yield F(tx(word, stAt([word.length - 1], "comparing")), "Step 1a: plurals (sses→ss).", 1);
    step += 1;
    const s1 = stem(word);
    yield F(tx(word, stAt([0], "comparing")), `After 1a/1b: "${s1}".`, 2, { stem: s1 });
    step += 1;
    yield F(
        tx(
            s1,
            stAt(
                s1.split("").map((_, i) => i),
                "sorted",
            ),
        ),
        `Stem "${s1}".`,
        3,
        { stem: s1 },
    );
    step += 1;
    yield F(tx(s1), `Stemming complete: "${word}" stems to "${s1}".`, 4, { stem: s1 });
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The Porter stemmer reduces English words to a common base by sequentially stripping and simplifying suffixes. Its steps handle plurals, past and progressive endings, and several derivational suffixes, each guarded by conditions on the word's structure.",
        "invariants": [
            "Each step transforms the word deterministically and preserves the leading portion of the stem.",
            "Suffix rules are applied in a fixed order with conditions such as the presence of a vowel in the preceding part."
        ],
        "correctness": "The ordered rules encode standard English morphology, for example caresses to caress and ponies to poni, and ed and ing are removed only after a vowel. Because the rules are conservative and ordered, related words collapse to the same stem, improving retrieval recall.",
        "complexityRationale": "Each step examines a constant-length suffix and performs constant work, so stemming is O(n) time with O(1) auxiliary space.",
        "uses": [
            "Normalizing terms in information retrieval and search engines",
            "Clustering morphologically related words",
            "Preprocessing for text classification"
        ],
        "references": [
            "Porter, An Algorithm for Suffix Stripping, 1980",
            "The official Porter stemmer specification"
        ],
        "workedExample": "\"caresses\" ends in \"sses\" so step 1a gives \"caress\"; \"cats\" loses the trailing \"s\" to become \"cat\"; \"feeding\" drops \"ing\" after the vowel e to become \"feed\"."
    },
    id: "porter-stemmer",
    name: "Porter Stemmer",
    category: "string",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { word: "caresses" },
    visualType: "text",
    run,
    pseudocode: [
        "strip plural endings like sses and ies",
        "remove past participles ed and ing with vowel check",
        "map double consonants and terminal y rules",
        "apply step mappings forational and tional endings",
        "reduce ive ness and ful suffixes by measure",
        "clean final e and double l conditions",
        "report stemmed word form",
    ],
};

export default module;
