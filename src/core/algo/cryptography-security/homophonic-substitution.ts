/**
 * homophonic-substitution.ts - Homophonic Substitution Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A homophonic substitution cipher assigns several ciphertext symbols to each
 * plaintext letter, with frequent letters receiving more symbols. Encoding
 * cycles through a letter's symbols so the same plaintext letter can appear as
 * different codes, flattening the letter-frequency distribution. Decoding uses
 * the reverse map, so every assigned symbol always returns to its letter.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a message of n letters
 *   Space: O(1) for the fixed code table plus O(n) for the output
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character entity per input letter.
 *   - The active letter is highlighted with the code chosen for it.
 *   - The final frame reports the full code string and its decoded text.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "encode" | "decode";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const EXTRA: Record<string, number> = { E: 4, T: 3, A: 3, O: 2, I: 2, N: 2, S: 2, R: 2 };

/** Fixed code table: each letter owns one or more unique two-digit codes. */
const CODES: Record<string, string[]> = {};
const REVERSE: Record<string, string> = {};
let nextCode = 10;
for (const letter of LETTERS) {
    const count = EXTRA[letter] ?? 1;
    const codes: string[] = [];
    for (let i = 0; i < count; i += 1) {
        const code = String(nextCode).padStart(2, "0");
        codes.push(code);
        REVERSE[code] = letter;
        nextCode += 1;
    }
    CODES[letter] = codes;
}

/** Encode letters into cycling homophones. */
function encode(text: string): string {
    const seen: Record<string, number> = {};
    const out: string[] = [];
    for (const ch of [...text]) {
        const letter = ch.toUpperCase();
        const codes = CODES[letter];
        if (!codes) continue;
        const index = seen[letter] ?? 0;
        seen[letter] = index + 1;
        out.push(codes[index % codes.length] as string);
    }
    return out.join(" ");
}

/** Decode a code string back to letters. */
function decode(text: string): string {
    return text
        .split(/[^0-9]+/)
        .filter((part) => part.length > 0)
        .map((code) => REVERSE[code] ?? "?")
        .join("");
}

/** Build one character entity per input symbol. */
function buildEntities(chars: string[], states: Map<number, EntityState>): VisualEntity[] {
    return chars.map((ch, index) => ({
        id: `char-${index}`,
        type: "character" as const,
        label: ch,
        value: ch,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; mode?: Mode } | null) ?? {};
    const mode: Mode = task.mode === "decode" ? "decode" : "encode";
    const text = typeof task.text === "string" ? task.text : "MEETMEATMIDNIGHT";
    const letters = [...text]
        .map((ch) => ch.toUpperCase())
        .filter((ch) => ch >= "A" && ch <= "Z");
    const states = new Map<number, EntityState>();
    let output = "";
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities([...text], states),
        edges: [],
        description: `${mode === "encode" ? "Encoding" : "Decoding"} ${letters.length} letter(s) with a homophonic code table.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { mode, output: "", input: text, tableSize: nextCode - 10, phase: "start" },
    };

    if (mode === "encode") {
        const seen: Record<string, number> = {};
        const tokens: string[] = [];
        for (let i = 0; i < letters.length; i += 1) {
            const letter = letters[i] as string;
            const codes = CODES[letter] as string[];
            const index = seen[letter] ?? 0;
            seen[letter] = index + 1;
            const code = codes[index % codes.length] as string;
            tokens.push(code);
            output = tokens.join(" ");
            states.clear();
            states.set(i, "active");
            yield {
                stepNumber: step++,
                entities: buildEntities([...text], states),
                edges: [],
                description: `Letter ${letter} (occurrence ${index + 1}) uses homophone ${code}.`,
                codeLineNumber: 3,
                layout: "text",
                meta: { mode, output, input: text, tableSize: nextCode - 10, phase: "step", index: i, code },
            };
        }
        output = tokens.join(" ");
    } else {
        const codes = text.split(/[^0-9]+/).filter((part) => part.length > 0);
        const decoded: string[] = [];
        for (let i = 0; i < codes.length; i += 1) {
            const code = codes[i] as string;
            const letter = REVERSE[code] ?? "?";
            decoded.push(letter);
            output = decoded.join("");
            states.clear();
            states.set(i, "active");
            yield {
                stepNumber: step++,
                entities: buildEntities([...text], states),
                edges: [],
                description: `Code ${code} maps back to letter ${letter}.`,
                codeLineNumber: 5,
                layout: "text",
                meta: { mode, output, input: text, tableSize: nextCode - 10, phase: "step", index: i, letter },
            };
        }
    }

    yield {
        stepNumber: step++,
        entities: buildEntities([...text], states),
        edges: [],
        description: `Homophonic ${mode} complete: "${output}".`,
        codeLineNumber: 6,
        layout: "text",
        meta: { mode, output, input: text, tableSize: nextCode - 10, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of one ciphertext symbol per letter, give common letters several symbols and rare letters one. Each time a letter appears, pick the next symbol in its set. A message with many E's therefore shows several different symbols, which hides the frequency pattern that breaks simple substitution.",
    invariants: [
        "Every code belongs to exactly one plaintext letter.",
        "A letter's symbols are chosen in rotation across its occurrences.",
        "Decoding any of a letter's symbols returns that letter.",
    ],
    correctness:
        "The code table is a many-to-one mapping with disjoint symbol sets per letter, so each two-digit code has a unique inverse. Encoding cycles through a letter's symbols but always picks one from that letter's set, and decoding maps every such symbol back to the same letter. Hence decode(encode(text)) reproduces the original letters regardless of which homophone was chosen.",
    complexityRationale:
        "The code table is fixed and small, and each letter needs one lookup and one counter update, so encoding and decoding are O(n). The table is O(1) space and the output is O(n).",
    uses: [
        "Historical ciphers designed to defeat frequency analysis",
        "Teaching how symbol multiplicity flattens letter distributions",
        "A precursor to probabilistic and homomorphic encryption ideas",
    ],
    references: [
        "Kahn, The Codebreakers",
        "Wikipedia, Homophonic substitution cipher",
    ],
    workedExample:
        "If E owns codes 14, 27, 43 and 55, the word SEE might encode with 40 for S and then 14, 27 for the two E's. Decoding 14 and 27 both return E.",
    },
    id: "homophonic-substitution",
    name: "Homophonic Substitution Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "MEETMEATMIDNIGHT", mode: "encode" },
    visualType: "text",
    run,
    pseudocode: [
        "read the message and the direction",
        "use a fixed table giving each letter one or more codes",
        "for encoding, cycle through a letter's codes on each occurrence",
        "separate the emitted codes so they can be read back",
        "for decoding, map each code to its owning letter",
        "collect the letters into the recovered message",
        "done: return the transformed message",
    ],
};

export default module;
