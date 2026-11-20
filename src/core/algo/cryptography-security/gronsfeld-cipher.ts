/**
 * gronsfeld-cipher.ts - Gronsfeld Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Gronsfeld cipher is a Vigenere variant whose key is a sequence of
 * decimal digits instead of letters. Each digit is used directly as a Caesar
 * shift from 0 to 9, so the keystream has only ten choices per position. It
 * was popular in telegraphy because numeric keys were easy to transmit.
 * Encryption adds the digit to a letter's index modulo 26; decryption
 * subtracts it. Non-letters pass through without advancing the key position.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a message of n characters
 *   Space: O(n) for the output and the character display
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character entity per input symbol.
 *   - The current character is CYAN while its digit shift is applied.
 *   - The final frame reports the full transformed message.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "encrypt" | "decrypt";

/** Extract decimal digits from a key string. */
function digits(key: string): number[] {
    return [...key].map((ch) => ch.charCodeAt(0) - 48).filter((d) => d >= 0 && d <= 9);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; key?: string; mode?: Mode } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "ATTACKATDAWN";
    const key = digits(typeof task.key === "string" ? task.key : "314159");
    const stream = key.length > 0 ? key : [0];
    const mode: Mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const output: string[] = [];
    let keyIndex = 0;

    const entities = (active: number): VisualEntity[] =>
        [...text].map((ch, index) => ({
            id: `char-${index}`,
            type: "character" as const,
            label: ch,
            value: ch,
            state: index === active ? "active" : index < active ? "sorted" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, output: output[index] ?? ch },
        }));

    yield {
        stepNumber: 0,
        entities: entities(-1),
        edges: [],
        description: `${mode === "encrypt" ? "Encrypting" : "Decrypting"} ${[...text].length} character(s) with digit key [${key.join(",")}].`,
        codeLineNumber: 0,
        layout: "text",
        meta: { mode, key, output: "", length: [...text].length },
    };
    let step = 1;
    const chars = [...text];
    for (let i = 0; i < chars.length; i += 1) {
        const ch = chars[i] ?? "";
        const code = ch.toUpperCase().charCodeAt(0) - 65;
        const isLetter = code >= 0 && code < 26;
        let mapped = ch;
        let shift = 0;
        if (isLetter) {
            shift = stream[keyIndex % stream.length] ?? 0;
            keyIndex += 1;
            const value = mode === "encrypt" ? (code + shift) % 26 : (code - shift + 26) % 26;
            mapped = String.fromCharCode(65 + value);
        }
        output.push(mapped);
        yield {
            stepNumber: step,
            entities: entities(i),
            edges: [],
            description: isLetter
                ? `Position ${i}: ${ch} shifted by digit ${shift} gives ${mapped}.`
                : `Position ${i}: "${ch}" is not a letter, so it is copied unchanged.`,
            codeLineNumber: isLetter ? (mode === "encrypt" ? 3 : 4) : 2,
            layout: "text",
            meta: { mode, key, output: output.join(""), index: i, shift },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: entities(-1),
        edges: [],
        description: `Gronsfeld ${mode} complete: "${output.join("")}".`,
        codeLineNumber: 6,
        layout: "text",
        meta: { mode, key, output: output.join(""), length: chars.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The Gronsfeld cipher is Vigenere with a number pad. Instead of using a key letter such as K for a shift of ten, it just writes the digit 1 and shifts by one. The digits repeat cyclically across the message, and each one adds a Caesar shift between zero and nine. It is simple to use by hand and was favored where numeric codes were easier to send.",
        invariants: [
            "Only alphabetic characters consume a key digit; others are copied unchanged.",
            "The digit sequence repeats cyclically from the start.",
            "Encryption followed by decryption with the same digits returns the original letters.",
        ],
        correctness:
            "For a letter at index p with current digit d, encryption emits c equal to p plus d modulo 26. Decryption subtracts the same digit, which is available because the keystream position advances only on letters and both sides see the same letters. Since d is added and then subtracted modulo 26, the original index is recovered exactly. Non-letters never advance the position on either side, so the two streams stay aligned.",
        complexityRationale:
            "Each character uses one modular arithmetic step and occasional key indexing, so time is linear in the message length. The output string and character entities occupy linear space.",
        uses: [
            "Historical telegraph and field ciphers",
            "Teaching the relationship between Vigenere and Caesar shifts",
            "Small-key substitution examples in cryptanalysis",
        ],
        references: [
            "Kahn, The Codebreakers",
            "Wikipedia, Gronsfeld cipher",
        ],
        workedExample:
            "With key 3141, the letter A (0) plus digit 3 becomes D. The next letter T (19) plus 1 wraps to U, and the third letter T plus 4 becomes X. Decrypting D with digit 3 gives A again.",
    },
    id: "gronsfeld-cipher",
    name: "Gronsfeld Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "ATTACKATDAWN", key: "314159", mode: "encrypt" },
    visualType: "text",
    run,
    pseudocode: [
        "extract the decimal digits of the key",
        "for each character of the message",
        "copy non-letters unchanged without advancing the key",
        "choose the next key digit cyclically",
        "encrypt by adding the digit modulo twenty-six",
        "decrypt by subtracting the digit modulo twenty-six",
        "convert the resulting index back to a letter",
        "done: return the transformed message",
    ],
};

export default module;
