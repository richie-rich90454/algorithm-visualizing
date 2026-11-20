/**
 * autokey-cipher.ts - Autokey Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The autokey cipher is a Vigenere variant whose keystream continues with the
 * plaintext itself. A short keyword starts the stream; after it is exhausted,
 * each plaintext letter becomes the next shift. Encryption adds the key letter
 * to the plaintext letter modulo 26. Decryption subtracts the key letter and
 * then appends the recovered plaintext letter, so the stream stays in sync.
 * Non-letters pass through without advancing the key position.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a message of n characters
 *   Space: O(n) for the keystream, output, and display
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character entity per input symbol.
 *   - The current character is CYAN while its shift is applied.
 *   - The final frame reports the full ciphertext or plaintext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "encrypt" | "decrypt";

/** Uppercase letter indices of a keyword; non-letters are ignored. */
function keyLetters(key: string): number[] {
    return [...key]
        .map((ch) => ch.toUpperCase().charCodeAt(0) - 65)
        .filter((code) => code >= 0 && code < 26);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; key?: string; mode?: Mode } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "ATTACKATDAWN";
    const keyword = keyLetters(typeof task.key === "string" ? task.key : "KEY");
    const mode: Mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const stream = [...keyword];
    let keyIndex = 0;
    const output: string[] = [];

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
        description: `${mode === "encrypt" ? "Encrypting" : "Decrypting"} with autokey stream starting from keyword shifts [${keyword.join(",")}].`,
        codeLineNumber: 0,
        layout: "text",
        meta: { mode, key: keyword, output: "", length: [...text].length },
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
            shift = stream[keyIndex] ?? 0;
            keyIndex += 1;
            const value = mode === "encrypt" ? (code + shift) % 26 : (code - shift + 26) % 26;
            mapped = String.fromCharCode(65 + value);
            // The autokey stream appends the plaintext letter, not the ciphertext letter.
            stream.push(mode === "encrypt" ? code : value);
        }
        output.push(mapped);
        yield {
            stepNumber: step,
            entities: entities(i),
            edges: [],
            description: isLetter
                ? `Position ${i}: ${ch} with key shift ${shift} gives ${mapped}; appended the plaintext letter to the stream.`
                : `Position ${i}: "${ch}" is not a letter, so it passes through unchanged.`,
            codeLineNumber: isLetter ? (mode === "encrypt" ? 3 : 4) : 2,
            layout: "text",
            meta: { mode, key: keyword, output: output.join(""), index: i, shift, streamLength: stream.length },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: entities(-1),
        edges: [],
        description: `Autokey ${mode} complete: "${output.join("")}".`,
        codeLineNumber: 6,
        layout: "text",
        meta: { mode, key: keyword, output: output.join(""), length: chars.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A simple Vigenere cipher repeats a short key, which leaves a visible period. The autokey avoids that by extending the key with the message itself: after the keyword runs out, the plaintext letter you just handled becomes the next shift. Decryption works because it recovers that same plaintext letter and appends it in turn. Non-letters are skipped so punctuation cannot desynchronize the stream.",
        invariants: [
            "The keystream begins with the keyword and then appends plaintext letter values.",
            "Only alphabetic characters advance the key position.",
            "Encryption followed by decryption recovers the original message.",
        ],
        correctness:
            "Encryption computes c_i as p_i plus k_i modulo 26, where k_i is the keyword for early positions and p_{i-m} for later ones. Decryption subtracts the same k_i, which it can reconstruct because it has already recovered every earlier plaintext letter. Thus (p_i plus k_i minus k_i) modulo 26 returns p_i at each step, and appending the recovered letter keeps the keystream identical to the encoder's.",
        complexityRationale:
            "Each character performs one modular addition or subtraction and at most one stream append, so time is linear in the message length. The keystream and output each store one value per letter, giving linear space.",
        uses: [
            "Historical classical cryptography and cryptanalysis study",
            "Teaching self-synchronizing keystreams",
            "Comparison baseline for periodic-key ciphers",
        ],
        references: [
            "Kahn, The Codebreakers",
            "Wikipedia, Autokey cipher",
        ],
        workedExample:
            "With keyword KEY and plaintext ATTACK, the first shifts are K, E and Y, so A plus K gives K. The next shift is the plaintext A, so T plus A gives T. Decryption subtracts K to recover A, then appends that A as the next shift and recovers T.",
    },
    id: "autokey-cipher",
    name: "Autokey Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "ATTACKATDAWN", key: "KEY", mode: "encrypt" },
    visualType: "text",
    run,
    pseudocode: [
        "convert the keyword to its list of letter shifts",
        "append plaintext letters to that list as they are consumed",
        "for each character of the message",
        "copy non-letters unchanged and do not advance the key",
        "encrypt by adding the key shift modulo twenty-six",
        "decrypt by subtracting the key shift modulo twenty-six",
        "append the plaintext letter to the autokey stream",
        "done: return the transformed message",
    ],
};

export default module;
