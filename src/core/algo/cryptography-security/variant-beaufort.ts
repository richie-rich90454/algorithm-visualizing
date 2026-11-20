/**
 * variant-beaufort.ts - Variant Beaufort Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The variant Beaufort cipher is the reciprocal of the Beaufort cipher. Where
 * Beaufort computes c = k - p, the variant computes c = p - k on encryption and
 * p = c + k on decryption. It is therefore the Vigenere decryption rule used
 * as encryption. The key repeats over the letters of the message, and
 * non-letters pass through untouched without advancing the key.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a message of n characters
 *   Space: O(n) for the displayed characters and output text
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character entity per input symbol.
 *   - The active letter is highlighted with its key letter and arithmetic.
 *   - The final frame reports the full transformed message.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "encrypt" | "decrypt";

const A = 65;
const LENGTH = 26;

/** Letter value 0-25, or -1 for a non-letter. */
function toValue(ch: string): number {
    const code = ch.toUpperCase().charCodeAt(0) - A;
    return code >= 0 && code < LENGTH ? code : -1;
}

/** Apply the variant Beaufort rule for one letter and one key letter. */
function combine(letter: string, key: string, mode: Mode): string {
    const p = toValue(letter);
    const k = toValue(key);
    if (p < 0 || k < 0) return letter;
    const raw = mode === "encrypt" ? p - k : p + k;
    return String.fromCharCode(A + ((raw % LENGTH) + LENGTH) % LENGTH);
}

/** Full-message transform with a repeating key. */
function transform(text: string, key: string, mode: Mode): string {
    const keyLetters = [...key].filter((ch) => toValue(ch) >= 0).map((ch) => ch.toUpperCase());
    if (keyLetters.length === 0) return text;
    let keyIndex = 0;
    const out: string[] = [];
    for (const ch of [...text]) {
        if (toValue(ch) < 0) {
            out.push(ch);
            continue;
        }
        const keyLetter = keyLetters[keyIndex % keyLetters.length] as string;
        keyIndex += 1;
        out.push(combine(ch, keyLetter, mode));
    }
    return out.join("");
}

/** One character entity per input symbol. */
function buildEntities(chars: string[], states: Map<number, EntityState>, output: string): VisualEntity[] {
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
        metadata: { index, output: output[index] ?? ch },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; key?: string; mode?: Mode } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "ATTACKATDAWN";
    const key = typeof task.key === "string" && task.key.length > 0 ? task.key : "KEYWORD";
    const mode: Mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const chars = [...text];
    const keyLetters = [...key].filter((ch) => toValue(ch) >= 0).map((ch) => ch.toUpperCase());
    const states = new Map<number, EntityState>();
    let keyIndex = 0;
    let output = "";
    const built: string[] = [];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(chars, states, output),
        edges: [],
        description: `${mode === "encrypt" ? "Encrypting" : "Decrypting"} ${chars.length} character(s) with the variant Beaufort key ${key}.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { key, mode, input: text, output: "", phase: "start" },
    };

    for (let i = 0; i < chars.length; i += 1) {
        const ch = chars[i] as string;
        let mapped = ch;
        let keyLetter = "-";
        if (keyLetters.length > 0 && toValue(ch) >= 0) {
            keyLetter = keyLetters[keyIndex % keyLetters.length] as string;
            keyIndex += 1;
            mapped = combine(ch, keyLetter, mode);
        }
        built.push(mapped);
        output = built.join("");
        states.clear();
        states.set(i, "active");
        const p = toValue(ch);
        const k = toValue(keyLetter);
        const arithmetic = p >= 0 && k >= 0
            ? mode === "encrypt" ? `(${p} minus ${k})` : `(${p} plus ${k})`
            : "unchanged";
        yield {
            stepNumber: step++,
            entities: buildEntities(chars, states, output),
            edges: [],
            description: `Letter ${ch} with key ${keyLetter}: ${arithmetic} modulo 26 gives ${mapped}.`,
            codeLineNumber: 4,
            layout: "text",
            meta: { key, mode, input: text, output, phase: "step", index: i, keyLetter },
        };
    }

    output = transform(text, key, mode);
    yield {
        stepNumber: step++,
        entities: buildEntities(chars, states, output),
        edges: [],
        description: `Variant Beaufort ${mode} complete: "${output}".`,
        codeLineNumber: 6,
        layout: "text",
        meta: { key, mode, input: text, output, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The variant Beaufort cipher uses a repeating keyword like Vigenere, but subtracts the key letter from the message letter on encryption. Decryption adds the key letter back. It is the reciprocal of the ordinary Beaufort cipher and shares its resistance to simple frequency analysis.",
        invariants: [
            "The key letters repeat in order and advance only on message letters.",
            "Encryption maps a letter to (letter minus key) modulo 26, and decryption adds the key.",
            "Encrypting and then decrypting with the same key restores the original message.",
        ],
        correctness:
            "For letter value p and key value k, encryption gives c = (p - k) mod 26 and decryption gives (c + k) = (p - k + k) = p mod 26. Because the key pointer advances only on letters, non-letters are copied unchanged in both directions and cannot shift the key alignment. The two operations are exact inverses on every input.",
        complexityRationale:
            "Each character is processed with a constant number of arithmetic steps and one key lookup, so both directions run in O(n) time. The character display and output string occupy O(n) space.",
        uses: [
            "Historical polyalphabetic cipher study and cryptanalysis teaching",
            "Comparing reciprocal and involutive cipher designs",
            "Reconstructing messages enciphered by Beaufort-family machines",
        ],
        references: [
            "Kahn, The Codebreakers",
            "Wikipedia, Beaufort cipher (variant)",
        ],
        workedExample:
            "With key letter K (10) and plaintext letter K (10), encryption gives (10 - 10) = 0, or A. Decryption adds the key back: (0 + 10) = 10, recovering K.",
    },
    id: "variant-beaufort",
    name: "Variant Beaufort Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "ATTACKATDAWN", key: "KEYWORD", mode: "encrypt" },
    visualType: "text",
    run,
    pseudocode: [
        "read the message, the repeating key and the direction",
        "extract the letter positions of the key",
        "for each character of the message",
        "copy non-letters unchanged without advancing the key",
        "convert the letter and next key letter to numbers",
        "on encryption subtract the key; on decryption add it, modulo 26",
        "done: return the transformed message",
    ],
};

export default module;
