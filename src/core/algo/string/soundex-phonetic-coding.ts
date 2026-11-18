/**
 * soundex-phonetic-coding.ts – Soundex.
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

function soundex(w: string): string {
    const up = w.toUpperCase().replace(/[^A-Z]/g, "");
    if (!up) return "0000";
    const map: Record<string, string> = {
        B: "1",
        F: "1",
        P: "1",
        V: "1",
        C: "2",
        G: "2",
        J: "2",
        K: "2",
        Q: "2",
        S: "2",
        X: "2",
        Z: "2",
        D: "3",
        T: "3",
        L: "4",
        M: "5",
        N: "5",
        R: "6",
    };
    const first = up[0] as string;
    let out = first,
        prev = map[first] ?? "0";
    for (let i = 1; i < up.length && out.length < 4; i += 1) {
        const c = up[i] as string;
        if (c === "H" || c === "W") continue;
        const d = map[c] ?? "0";
        if (d === "0") {
            prev = "0";
            continue;
        }
        if (d !== prev) out += d;
        prev = d;
    }
    return (out + "000").slice(0, 4);
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { word?: string } | null) ?? {};
    const word = t.word ?? "Euler";
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
    yield F(tx(word), `Soundex("${word}").`, 0);
    step += 1;
    yield F(tx(word, stAt([0], "comparing")), `Keep first letter "${word[0]}".`, 1);
    step += 1;
    const code = soundex(word);
    yield F(
        tx(word, stAt([1, 2], "comparing")),
        `Map consonants of "${word}", drop vowels/H/W.`,
        2,
        { code },
    );
    step += 1;
    yield F(
        tx(
            word,
            stAt(
                word.split("").map((_, i) => i),
                "sorted",
            ),
        ),
        `Code "${code}".`,
        3,
        { code },
    );
    step += 1;
    yield F(tx(word), `Soundex complete: "${word}" codes to "${code}".`, 4, { code });
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Soundex encodes a name into a letter plus three digits so that names sounding similar get the same code. It keeps the first letter, maps consonants to digit groups, drops vowels and the letters H and W, collapses repeated digits, and pads the result to four characters.",
        "invariants": [
            "The code begins with the original first letter followed by at most three digits.",
            "Vowels and the letters H and W act as separators that reset the collapse rule but are not emitted."
        ],
        "correctness": "Consonants with similar pronunciation share a digit group, so different spellings of the same surname converge, and collapsing adjacent equal digits avoids double-counting a sound. Padding yields a fixed-width key suitable for indexing.",
        "complexityRationale": "The word is scanned once with constant work per character, giving O(n) time and O(1) auxiliary space.",
        "uses": [
            "Census and genealogy name indexing",
            "Fuzzy name lookup in databases",
            "Deduplicating customer records with spelling variations"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 3, Soundex section",
            "Russell, U.S. Census Soundex system"
        ],
        "workedExample": "\"Euler\" keeps E, maps L to 4 and R to 6, drops the vowels, and pads with zeros to give \"E460\"; \"Euller\" collapses the double L to one 4 and produces the same code."
    },
    id: "soundex-phonetic-coding",
    name: "Soundex",
    category: "string",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { word: "Euler" },
    visualType: "text",
    run,
    pseudocode: [
        "retain first letter of input word uppercase",
        "map consonants to digit codes by groups",
        "collapse adjacent equal digit codes",
        "remove vowels and H W separators",
        "pad with zeros or truncate to four chars",
        "verify code format letter plus three digits",
        "report four-character Soundex code",
    ],
};

export default module;
