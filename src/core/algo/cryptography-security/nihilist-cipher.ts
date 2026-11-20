/**
 * nihilist-cipher.ts - Nihilist Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The nihilist cipher is a two-step numeric cipher. First each plaintext letter
 * is converted to a two-digit coordinate in a 5 by 5 Polybius square (I and J
 * share a cell). Then a repeating numeric key is added to each coordinate
 * modulo 100, producing a stream of two-digit numbers. Decryption subtracts the
 * key and maps the coordinates back to letters.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a message of n letters
 *   Space: O(n) for the displayed characters and the number stream
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character entity per input symbol (letter or digit).
 *   - The active symbol is highlighted with its numeric conversion.
 *   - The final frame reports the complete number stream.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "encrypt" | "decrypt";

const SQUARE = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

/** Coordinate (two digits) of a letter in the Polybius square. */
function toNumber(letter: string): number | null {
    const normalized = letter === "J" ? "I" : letter;
    const index = SQUARE.indexOf(normalized);
    if (index < 0) return null;
    return (Math.floor(index / 5) + 1) * 10 + (index % 5) + 1;
}

/** Letter at a two-digit Polybius coordinate. */
function toLetter(value: number): string {
    const row = Math.floor(value / 10) - 1;
    const col = (value % 10) - 1;
    if (row < 0 || row > 4 || col < 0 || col > 4) return "?";
    return SQUARE[row * 5 + col] ?? "?";
}

/** Parse a cipher string such as "34 51 27" into numbers. */
function parseNumbers(text: string): number[] {
    return text
        .split(/[^0-9]+/)
        .filter((part) => part.length > 0)
        .map((part) => Number.parseInt(part, 10) % 100);
}

/** Run the full transform over a message. */
function transform(text: string, key: number[]): string {
    if (key.length === 0) return text;
    const letters = [...text].filter((ch) => ch >= "A" && ch <= "Z");
    const out: string[] = [];
    let keyIndex = 0;
    for (const letter of letters) {
        const value = toNumber(letter);
        if (value === null) continue;
        const k = key[keyIndex % key.length] as number;
        keyIndex += 1;
        out.push(String((value + k + 100) % 100).padStart(2, "0"));
    }
    return out.join(" ");
}

/** Build character entities for a display string. */
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
    const task = (input as { text?: string; key?: number[]; mode?: Mode } | null) ?? {};
    const mode: Mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const text = typeof task.text === "string" ? task.text : "ATTACKATDAWN";
    const key: number[] = Array.isArray(task.key) && task.key.length > 0 ? task.key : [23, 41, 15, 32];
    const letters = [...text].filter((ch) => ch >= "A" && ch <= "Z");
    const states = new Map<number, EntityState>();
    let output = "";
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities([...text], states),
        edges: [],
        description: `${mode === "encrypt" ? "Encrypting" : "Decrypting"} ${letters.length} letter(s) with numeric key ${key.join(", ")}.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { key, mode, output: "", input: text, phase: "start" },
    };

    if (mode === "encrypt") {
        const built: string[] = [];
        let keyIndex = 0;
        for (let i = 0; i < letters.length; i += 1) {
            const letter = letters[i] as string;
            const value = toNumber(letter);
            if (value === null) continue;
            const k = key[keyIndex % key.length] as number;
            keyIndex += 1;
            const cipherNumber = (value + k + 100) % 100;
            built.push(String(cipherNumber).padStart(2, "0"));
            output = built.join(" ");
            states.clear();
            states.set(i, "active");
            yield {
                stepNumber: step++,
                entities: buildEntities([...text], states),
                edges: [],
                description: `${letter} is coordinate ${value}; add key ${k} gives ${String(cipherNumber).padStart(2, "0")}.`,
                codeLineNumber: 3,
                layout: "text",
                meta: { key, mode, output, input: text, phase: "step", index: i, value, k },
            };
        }
        output = built.join(" ");
    } else {
        const numbers = parseNumbers(text);
        const built: string[] = [];
        for (let i = 0; i < numbers.length; i += 1) {
            const cipherNumber = numbers[i] as number;
            const k = key[i % key.length] as number;
            const value = (cipherNumber - k + 100) % 100;
            built.push(toLetter(value));
            output = built.join("");
            states.clear();
            states.set(i, "active");
            yield {
                stepNumber: step++,
                entities: buildEntities([...text], states),
                edges: [],
                description: `${String(cipherNumber).padStart(2, "0")} minus key ${k} is coordinate ${value}, or ${toLetter(value)}.`,
                codeLineNumber: 5,
                layout: "text",
                meta: { key, mode, output, input: text, phase: "step", index: i, value, k },
            };
        }
    }

    yield {
        stepNumber: step++,
        entities: buildEntities([...text], states),
        edges: [],
        description: `Nihilist ${mode} complete: "${output}".`,
        codeLineNumber: 6,
        layout: "text",
        meta: { key, mode, output, input: text, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Turn each letter into a pair of digits that name its row and column in a square, then add a secret number to that pair. The receiver subtracts the same repeating numbers and looks the pair up again. It hides a letter cipher behind simple arithmetic, which makes it easy to perform by hand.",
        invariants: [
            "Each letter maps to a two-digit coordinate in the 5 by 5 square.",
            "The numeric key repeats cyclically across letters.",
            "Subtraction after addition modulo 100 recovers the original coordinate.",
        ],
        correctness:
            "For a letter with coordinate v and key value k, encryption emits (v + k) mod 100. Decryption computes ((v + k) - k) mod 100 = v mod 100, which is the original coordinate in the 11 to 55 range. Mapping that coordinate back through the square returns the original letter. Combining I and J into one cell keeps the square at 25 cells without ambiguity in the reverse map, since both map to the same symbol.",
        complexityRationale:
            "Each letter requires a constant-time square lookup and modular addition or subtraction, so both directions are O(n). The number stream and the character display use O(n) space.",
        uses: [
            "Historical hand cipher used by the Russian nihilists",
            "Teaching the combination of substitution and modular arithmetic",
            "A precursor to more modern numeric and book ciphers",
        ],
        references: [
            "Kahn, The Codebreakers",
            "Wikipedia, Nihilist cipher",
        ],
        workedExample:
            "In the square A is 11. With key 23, encrypting A gives (11 + 23) = 34. Decrypting 34 subtracts 23 to get 11, which maps back to A.",
    },
    id: "nihilist-cipher",
    name: "Nihilist Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "ATTACKATDAWN", key: [23, 41, 15, 32], mode: "encrypt" },
    visualType: "text",
    run,
    pseudocode: [
        "read the message, the numeric key and the direction",
        "build a 5 by 5 Polybius square with I and J combined",
        "for each plaintext letter, find its two-digit coordinate",
        "add the next repeating key number modulo 100 to encrypt",
        "to decrypt, subtract the key number from each cipher value",
        "map the recovered coordinate back to a letter",
        "done: return the transformed message",
    ],
};

export default module;
