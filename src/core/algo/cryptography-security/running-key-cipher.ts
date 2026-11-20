/**
 * running-key-cipher.ts - Running Key Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A running key cipher is a Vigenere variant whose key is a long piece of text
 * rather than a short repeated word. Each message letter is shifted by the
 * corresponding key letter, so the key does not repeat within the message.
 * Decryption subtracts the same key letters. Non-letters pass through and do
 * not consume the key.
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
 *   - The active letter is highlighted alongside its key letter and shift.
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

/** Build the letter-only key stream. */
function keyStream(key: string): string[] {
    return [...key]
        .map((ch) => ch.toUpperCase())
        .filter((ch) => toValue(ch) >= 0);
}

/** Run the Vigenere-style transform over a message with a running key. */
function transform(text: string, key: string, mode: Mode): string {
    const stream = keyStream(key);
    if (stream.length === 0) return text;
    const out: string[] = [];
    let keyIndex = 0;
    for (const ch of [...text]) {
        const p = toValue(ch);
        if (p < 0) {
            out.push(ch);
            continue;
        }
        const k = toValue(stream[keyIndex % stream.length] as string);
        keyIndex += 1;
        const shifted = mode === "encrypt" ? (p + k) % LENGTH : ((p - k) % LENGTH + LENGTH) % LENGTH;
        out.push(String.fromCharCode(A + shifted));
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
    const key =
        typeof task.key === "string" && keyStream(task.key).length > 0
            ? task.key
            : "THESECRETPASSAGEKNOWNONLYTOBOTHPARTIES";
    const mode: Mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const chars = [...text];
    const stream = keyStream(key);
    const states = new Map<number, EntityState>();
    let keyIndex = 0;
    let output = "";
    const built: string[] = [];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(chars, states, output),
        edges: [],
        description: `${mode === "encrypt" ? "Encrypting" : "Decrypting"} ${chars.length} character(s) with a ${stream.length}-letter running key.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { mode, keyLength: stream.length, output: "", input: text, phase: "start" },
    };

    for (let i = 0; i < chars.length; i += 1) {
        const ch = chars[i] as string;
        let mapped = ch;
        let keyLetter = "-";
        const p = toValue(ch);
        if (p >= 0 && stream.length > 0) {
            keyLetter = stream[keyIndex % stream.length] as string;
            keyIndex += 1;
            const k = toValue(keyLetter);
            const shifted = mode === "encrypt" ? (p + k) % LENGTH : ((p - k) % LENGTH + LENGTH) % LENGTH;
            mapped = String.fromCharCode(A + shifted);
        }
        built.push(mapped);
        output = built.join("");
        states.clear();
        states.set(i, "active");
        yield {
            stepNumber: step++,
            entities: buildEntities(chars, states, output),
            edges: [],
            description: `Letter ${ch} with running key ${keyLetter}: ${mode === "encrypt" ? "add" : "subtract"} the shift gives ${mapped}.`,
            codeLineNumber: 4,
            layout: "text",
            meta: { mode, keyLength: stream.length, output, input: text, phase: "step", index: i, keyLetter },
        };
    }

    output = transform(text, key, mode);
    yield {
        stepNumber: step++,
        entities: buildEntities(chars, states, output),
        edges: [],
        description: `Running key ${mode} complete: "${output}".`,
        codeLineNumber: 6,
        layout: "text",
        meta: { mode, keyLength: stream.length, output, input: text, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A running key cipher shifts each letter by the next letter of a long text instead of a short keyword. Because the key is as long as the message, the repeating pattern that makes ordinary Vigenere easy to attack is gone. Both sides must possess the same key text and start at the same place.",
    invariants: [
        "The key stream contains only letters from the key text.",
        "A non-letter in the message is copied and does not advance the key.",
        "Encryption adds a key shift and decryption subtracts the identical shift.",
    ],
    correctness:
        "For message letter p and key letter k, encryption emits (p + k) mod 26. Decryption computes ((p + k) - k) mod 26 = p mod 26, restoring the original letter. Since both directions skip non-letters and advance the key pointer in lockstep, the key letters align identically, so the round trip succeeds for the whole message.",
    complexityRationale:
        "Building the key stream scans the key once and each message character needs one modular operation, so time is O(n + keyLength). The output and character display use O(n) space.",
    uses: [
        "Historical manual encryption with book or passage keys",
        "Teaching why key length and non-repetition resist frequency analysis",
        "A conceptual bridge to one-time pads",
    ],
    references: [
        "Kahn, The Codebreakers",
        "Wikipedia, Running key cipher",
    ],
    workedExample:
        "With key text START, the letter A shifted by S (18) becomes S; decrypting S subtracts 18 and returns A. A space in the message is copied and does not consume a key letter.",
    },
    id: "running-key-cipher",
    name: "Running Key Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n + keyLength)", space: "O(n)" },
    defaultInput: { text: "ATTACKATDAWN", key: "THESECRETPASSAGEKNOWNONLYTOBOTHPARTIES", mode: "encrypt" },
    visualType: "text",
    run,
    pseudocode: [
        "read the message, the running key text and the direction",
        "extract the letters of the key into a key stream",
        "for each character of the message",
        "copy non-letters unchanged without advancing the key",
        "add the next key letter when encrypting, subtract when decrypting",
        "wrap the result into the 26-letter alphabet",
        "done: return the transformed message",
    ],
};

export default module;
