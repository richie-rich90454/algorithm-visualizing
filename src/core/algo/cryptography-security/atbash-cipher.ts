/**
 * atbash-cipher.ts - Atbash Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Atbash cipher reverses the alphabet: A maps to Z, B to Y, and so on,
 * using c = 25 - p for a letter's zero-based position. Because the mapping is
 * its own inverse, the same routine encrypts and decrypts. Non-letters are
 * copied unchanged. It is one of the earliest recorded substitution ciphers.
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
 *   - The current character is CYAN while its mirror is computed.
 *   - The final frame shows the full converted message.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Mirror one uppercase letter; pass other characters through. */
function mirror(ch: string): string {
    const upper = ch.toUpperCase();
    const code = upper.charCodeAt(0) - 65;
    if (code < 0 || code > 25) return ch;
    const mapped = String.fromCharCode(65 + (25 - code));
    return ch === upper ? mapped : mapped.toLowerCase();
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "ATBASH CIPHER";
    const chars = [...text];
    const output: string[] = [];

    const entities = (active: number): VisualEntity[] =>
        chars.map((ch, index) => ({
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
        description: `Applying the Atbash alphabet mirror to ${chars.length} character(s).`,
        codeLineNumber: 0,
        layout: "text",
        meta: { output: "", length: chars.length },
    };
    let step = 1;
    for (let i = 0; i < chars.length; i += 1) {
        const mapped = mirror(chars[i] ?? "");
        output.push(mapped);
        yield {
            stepNumber: step,
            entities: entities(i),
            edges: [],
            description: `Character ${i} "${chars[i]}" maps to "${mapped}" by 25 minus its letter index.`,
            codeLineNumber: chars[i] === mapped ? 2 : 3,
            layout: "text",
            meta: { output: output.join(""), index: i, input: chars[i], mapped },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: entities(-1),
        edges: [],
        description: `Atbash conversion complete: "${output.join("")}".`,
        codeLineNumber: 5,
        layout: "text",
        meta: { output: output.join(""), length: chars.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Write the alphabet forward above the alphabet backward. Each letter is replaced by the one directly beneath it, so A becomes Z and T becomes G. The rule is perfectly symmetric: applying it twice restores the original text, so encryption and decryption are the same operation.",
        invariants: [
            "A letter always maps to a letter and a non-letter is copied unchanged.",
            "The mapping is an involution: mirroring twice returns the original character.",
            "Distinct letters map to distinct letters, so the substitution is a bijection.",
        ],
        correctness:
            "For a letter with zero-based index p the cipher returns index 25 minus p. Applying it again gives 25 minus (25 minus p), which equals p, so the transformation is its own inverse. Since p ranges over all 26 distinct indices, the map is a bijection and no two plaintext letters collide.",
        complexityRationale:
            "Each character needs a single arithmetic mapping and the output string is built once, so time is linear in the message length. The character entities and output string also take linear space.",
        uses: [
            "Teaching substitution ciphers and involutions",
            "Puzzle encoding and simple reversible obfuscation",
            "Historical cryptanalysis examples",
        ],
        references: [
            "Kahn, The Codebreakers",
            "Wikipedia, Atbash cipher",
        ],
        workedExample:
            "Encoding ATBASH gives ZGZYZSH because A maps to Z, T to G, B to Y, A to Z, S to H and H to S. Encoding the result again returns ATBASH.",
    },
    id: "atbash-cipher",
    name: "Atbash Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "ATBASH CIPHER" },
    visualType: "text",
    run,
    pseudocode: [
        "for each character of the message",
        "if the character is not a letter copy it unchanged",
        "convert the letter to an index from zero to twenty-five",
        "replace it with the letter at index twenty-five minus that value",
        "append the converted character to the output",
        "done: return the mirrored message",
    ],
};

export default module;
