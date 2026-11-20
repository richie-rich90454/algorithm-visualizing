/**
 * affine-cipher.ts - Affine Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The affine cipher maps each letter to a number from 0 to 25 and applies the
 * arithmetic transformation c = (a * p + b) mod 26. Decryption recovers the
 * plaintext with p = inverse(a) * (c - b) mod 26. The transformation is a
 * bijection exactly when a is coprime with 26. Non-letters pass through.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a message of n characters
 *   Space: O(n) for the output text and the displayed characters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character entity per input symbol.
 *   - The current character is highlighted while its number is transformed.
 *   - The final frame reports the full transformed message.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "encrypt" | "decrypt";

const ALPHABET_LENGTH = 26;

/** Greatest common divisor, used to validate the multiplier. */
function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

/** Modular inverse of a modulo 26, or 1 when no inverse exists. */
function inverse(a: number): number {
    for (let x = 0; x < ALPHABET_LENGTH; x += 1) {
        if ((a * x) % ALPHABET_LENGTH === 1) return x;
    }
    return 1;
}

/** The affine cipher module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; a?: number; b?: number; mode?: Mode } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "AFFINE CIPHER";
    const requestedA = Math.floor(task.a ?? 5);
    const b = ((Math.floor(task.b ?? 8) % ALPHABET_LENGTH) + ALPHABET_LENGTH) % ALPHABET_LENGTH;
    const mode: Mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const a = gcd(requestedA, ALPHABET_LENGTH) === 1 ? ((requestedA % 26) + 26) % 26 : 1;
    const aInv = inverse(a);
    const key = mode === "encrypt" ? a : aInv;

    const transform = (value: number): number =>
        mode === "encrypt"
            ? (key * value + b) % ALPHABET_LENGTH
            : ((key * (value - b)) % ALPHABET_LENGTH + ALPHABET_LENGTH) % ALPHABET_LENGTH;

    const chars = [...text];
    const output: string[] = [];
    const states = new Map<number, EntityState>();

    const entities = (): VisualEntity[] =>
        chars.map((ch, index) => ({
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

    yield {
        stepNumber: 0,
        entities: entities(),
        edges: [],
        description: `${mode === "encrypt" ? "Encrypting" : "Decrypting"} ${chars.length} character(s) with a=${a}, b=${b}${gcd(requestedA, 26) !== 1 ? " (invalid multiplier replaced by 1)" : ""}.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { a, b, aInv, mode, output: "", validMultiplier: gcd(requestedA, 26) === 1 },
    };
    let step = 1;
    for (let i = 0; i < chars.length; i += 1) {
        const ch = chars[i] as string;
        const upper = ch.toUpperCase();
        const code = upper.charCodeAt(0) - 65;
        const isLetter = code >= 0 && code < ALPHABET_LENGTH;
        const mapped = isLetter ? String.fromCharCode(65 + transform(code)) : ch;
        output.push(mapped);
        states.clear();
        states.set(i, "active");
        yield {
            stepNumber: step,
            entities: entities(),
            edges: [],
            description: isLetter
                ? `Letter ${ch} is ${code}; ${mode === "encrypt" ? "a*p+b" : "inverse(a)*(c-b)"} gives ${transform(code)}, or ${mapped}.`
                : `Character ${JSON.stringify(ch)} is not a letter, so it is copied unchanged.`,
            codeLineNumber: isLetter ? (mode === "encrypt" ? 5 : 6) : 3,
            layout: "text",
            meta: { a, b, aInv, mode, output: output.join(""), index: i, validMultiplier: gcd(requestedA, 26) === 1 },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: entities(),
        edges: [],
        description: `Affine ${mode} complete: "${output.join("")}".`,
        codeLineNumber: 8,
        layout: "text",
        meta: { a, b, aInv, mode, output: output.join(""), validMultiplier: gcd(requestedA, 26) === 1 },
    };
}

/** The affine cipher module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The affine cipher treats letters as numbers and applies a line: multiply by a, add b, and wrap around the 26-letter alphabet. Multiplication alone or a shift alone are both weak, and combining them gives 312 possible keys. Decryption is possible only when a has a modular inverse, which means a and 26 share no common factor.",
        invariants: [
            "A letter maps to a letter and a non-letter is copied unchanged.",
            "The multiplier a is coprime with 26, so the letter mapping is a bijection.",
            "Encryption followed by decryption returns the original letter.",
        ],
        correctness:
            "Because gcd(a, 26) is one, there exists an inverse aInv with aInv * a congruent to one modulo 26. Applying decryption to c = (a*p + b) mod 26 gives aInv*(a*p + b - b) = p modulo 26, so the original letter is recovered. Bijectivity also means distinct plaintext letters produce distinct ciphertext letters, so no information is lost by the mapping itself.",
        complexityRationale:
            "Finding the modular inverse by scanning at most 26 candidates is constant time, and each character needs a fixed number of arithmetic operations, so encryption and decryption are O(n). The output string and character display use O(n) space.",
        uses: [
            "Teaching substitution ciphers and modular arithmetic",
            "The multiplicative layer inside more complex classical ciphers",
            "Understanding why key spaces and invertibility matter in cryptography",
        ],
        references: [
            "Kahn, The Codebreakers",
            "Wikipedia, Affine cipher",
        ],
        workedExample:
            "With a=5 and b=8 the letter A (0) maps to 8, or I, and B (1) maps to 13, or N. Since the inverse of 5 modulo 26 is 21, decrypting I computes 21*(8-8)=0 and returns A.",
    },
    id: "affine-cipher",
    name: "Affine Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "AFFINE CIPHER", a: 5, b: 8, mode: "encrypt" },
    visualType: "text",
    run,
    pseudocode: [
        "choose a multiplier coprime with 26 and a shift b",
        "compute the modular inverse of the multiplier",
        "for each character of the message",
        "copy non-letters unchanged",
        "convert each letter to a number from 0 to 25",
        "encrypt with (a * p + b) modulo 26",
        "decrypt with inverse(a) * (c - b) modulo 26",
        "convert back to a letter and append it",
        "done: return the transformed message",
    ],
};

export default module;
