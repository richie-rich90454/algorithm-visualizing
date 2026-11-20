/**
 * beaufort-cipher.ts - Beaufort Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Beaufort cipher is a polyalphabetic substitution related to Vigenere.
 * For each plaintext letter p and key letter k, the ciphertext letter is
 * c = (k - p) mod 26. Decryption uses the same formula with the roles swapped:
 * p = (k - c) mod 26. That symmetry means one routine both encrypts and
 * decrypts. The key repeats across the letters of the message.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a message of n characters
 *   Space: O(n) for the displayed characters and the output text
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

/** Convert an uppercase letter to 0-25, or -1 for a non-letter. */
function toValue(ch: string): number {
    const code = ch.toUpperCase().charCodeAt(0) - A;
    return code >= 0 && code < LENGTH ? code : -1;
}

/** Transform one letter pair with the symmetric Beaufort rule. */
function combine(letter: string, key: string): string {
    const p = toValue(letter);
    const k = toValue(key);
    if (p < 0 || k < 0) return letter;
    return String.fromCharCode(A + (((k - p) % LENGTH) + LENGTH) % LENGTH);
}

/** Run the Beaufort transform over a whole message with a repeating key. */
function transform(text: string, key: string): string {
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
        out.push(combine(ch, keyLetter));
    }
    return out.join("");
}

/** Build one character entity per input symbol. */
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
    const states = new Map<number, EntityState>();
    const keyLetters = [...key].filter((ch) => toValue(ch) >= 0).map((ch) => ch.toUpperCase());
    let keyIndex = 0;
    let output = "";
    const built: string[] = [];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(chars, states, output),
        edges: [],
        description: `${mode === "encrypt" ? "Encrypting" : "Decrypting"} ${chars.length} character(s) with Beaufort key ${key}.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { key, mode, output: "", input: text, phase: "start" },
    };

    for (let i = 0; i < chars.length; i += 1) {
        const ch = chars[i] as string;
        let mapped = ch;
        let keyLetter = "-";
        if (toValue(ch) >= 0 && keyLetters.length > 0) {
            keyLetter = keyLetters[keyIndex % keyLetters.length] as string;
            keyIndex += 1;
            mapped = combine(ch, keyLetter);
        }
        built.push(mapped);
        output = built.join("");
        states.clear();
        states.set(i, "active");
        yield {
            stepNumber: step++,
        entities: buildEntities(chars, states, output),
        edges: [],
        description: `Letter ${ch} with key ${keyLetter}: (${keyLetter} minus ${ch}) modulo 26 gives ${mapped}.`,
        codeLineNumber: 4,
        layout: "text",
        meta: { key, mode, output, input: text, phase: "step", index: i, keyLetter },
        };
    }

    output = transform(text, key);
    yield {
        stepNumber: step++,
        entities: buildEntities(chars, states, output),
        edges: [],
        description: `Beaufort ${mode} complete: "${output}".`,
        codeLineNumber: 6,
        layout: "text",
        meta: { key, mode, output, input: text, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Like Vigenere, the Beaufort cipher uses a repeating keyword, but it subtracts the message letter from the key letter instead of adding them. The same subtraction works in reverse, so the encryption routine is also the decryption routine. Non-letters pass through untouched and do not advance the key.",
        invariants: [
            "The key letters repeat in order and advance only on message letters.",
            "Each letter maps to (key minus letter) modulo 26.",
            "Applying the transform twice with the same key returns the original message.",
        ],
        correctness:
            "For letter value p and key value k, encryption produces c = (k - p) mod 26. Applying the same rule to c gives (k - c) = (k - (k - p)) = p mod 26, so the transform is its own inverse. Non-letters are copied and skipped by the key pointer in both directions, so they cannot disturb the alignment of key letters.",
        complexityRationale:
            "Each character needs a constant number of arithmetic operations and key indexing, so both encryption and decryption are O(n). The output and the character display use O(n) space.",
        uses: [
            "Historical polyalphabetic cipher study",
            "Teaching involutive ciphers where encryption equals decryption",
            "Comparison with Vigenere and variant Beaufort variants",
        ],
        references: [
            "Kahn, The Codebreakers",
            "Wikipedia, Beaufort cipher",
        ],
        workedExample:
            "With key letter K (10) and plaintext letter A (0), the ciphertext is (10 - 0) = 10, or K. Applying the rule again gives (10 - 10) = 0, recovering A.",
    },
    id: "beaufort-cipher",
    name: "Beaufort Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "ATTACKATDAWN", key: "KEYWORD", mode: "encrypt" },
    visualType: "text",
    run,
    pseudocode: [
        "read the message, the key and the direction",
        "extract the letter positions of the key",
        "for each character of the message",
        "copy non-letters unchanged without advancing the key",
        "take the next key letter and convert both letters to numbers",
        "replace the letter with (key minus letter) modulo 26",
        "done: return the transformed message",
    ],
};

export default module;
