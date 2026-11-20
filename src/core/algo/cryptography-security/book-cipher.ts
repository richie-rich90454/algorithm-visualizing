/**
 * book-cipher.ts - Book Cipher (Coordinate Lookup)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A book cipher replaces each plaintext word with the coordinates of that word
 * in an agreed book. Both parties own the same text, so the pair (line number,
 * word number) identifies the word without transmitting it. This module builds
 * a first-occurrence lookup from the supplied book text and encodes each word
 * as "line.word"; decoding reverses the lookup.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b) to index the book plus O(n) per message
 *   Space: O(b) for the lookup table, where b is the number of book words
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character entity per word symbol is shown for the input.
 *   - The active word is highlighted with the coordinates it resolves to.
 *   - The final frame reports the coordinate string and its decoded words.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "encode" | "decode";

/** Normalize a word for lookup. */
function normalize(word: string): string {
    return word.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Build a map from normalized word to its first (line, word) coordinates. */
function buildLookup(book: string[]): Map<string, [number, number]> {
    const lookup = new Map<string, [number, number]>();
    book.forEach((line, lineIndex) => {
        line.split(/\s+/).forEach((word, wordIndex) => {
            const key = normalize(word);
            if (key && !lookup.has(key)) lookup.set(key, [lineIndex + 1, wordIndex + 1]);
        });
    });
    return lookup;
}

/** Build the character display for the input string. */
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
    const task = (input as { text?: string; book?: string[]; mode?: Mode } | null) ?? {};
    const mode: Mode = task.mode === "decode" ? "decode" : "encode";
    const text = typeof task.text === "string" ? task.text : "ATTACK AT DAWN";
    const book: string[] = Array.isArray(task.book)
        ? task.book
        : [
              "THE ATTACK WILL BEGIN AT DAWN",
              "BRING ALL TROOPS TO THE EAST WALL",
              "WAIT FOR THE SIGNAL BEFORE MOVING",
          ];
    const lookup = buildLookup(book);
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    const states = new Map<number, EntityState>();
    let output = "";
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities([...text], states),
        edges: [],
        description: `${mode === "encode" ? "Encoding" : "Decoding"} ${words.length} word(s) against a ${book.length}-line book.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { mode, output: "", input: text, bookLines: book.length, phase: "start" },
    };

    if (mode === "encode") {
        const tokens: string[] = [];
        for (let i = 0; i < words.length; i += 1) {
            const word = words[i] as string;
            const coords = lookup.get(normalize(word));
            const token = coords ? `${coords[0]}.${coords[1]}` : `!${word}`;
            tokens.push(token);
            output = tokens.join(" ");
            states.clear();
            states.set(i, "active");
            yield {
                stepNumber: step++,
                entities: buildEntities([...text], states),
                edges: [],
                description: coords
                    ? `Word ${word} appears at line ${coords[0]}, word ${coords[1]}; sent as ${token}.`
                    : `Word ${word} is not in the book; sent literally as ${token}.`,
                codeLineNumber: 3,
                layout: "text",
                meta: { mode, output, input: text, bookLines: book.length, phase: "step", index: i, token },
            };
        }
        output = tokens.join(" ");
    } else {
        const tokens = words;
        const decoded: string[] = [];
        for (let i = 0; i < tokens.length; i += 1) {
            const token = tokens[i] as string;
            let word = token;
            if (token.startsWith("!")) {
                word = token.slice(1);
            } else {
                const [lineStr, wordStr] = token.split(".");
                const line = Number.parseInt(lineStr ?? "", 10);
                const wordIndex = Number.parseInt(wordStr ?? "", 10);
                const found = book[line - 1]?.split(/\s+/)[wordIndex - 1];
                word = found ?? "?";
            }
            decoded.push(word);
            output = decoded.join(" ");
            states.clear();
            states.set(i, "active");
            yield {
                stepNumber: step++,
                entities: buildEntities([...text], states),
                edges: [],
                description: `Token ${token} resolves to the book word ${word}.`,
                codeLineNumber: 5,
                layout: "text",
                meta: { mode, output, input: text, bookLines: book.length, phase: "step", index: i, word },
            };
        }
    }

    yield {
        stepNumber: step++,
        entities: buildEntities([...text], states),
        edges: [],
        description: `Book cipher ${mode} complete: "${output}".`,
        codeLineNumber: 6,
        layout: "text",
        meta: { mode, output, input: text, bookLines: book.length, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of sending a secret word, send where to find it in a book you both own. The first word that matches is recorded by its line and position. Because the book never travels with the message, an interceptor who lacks the book sees only harmless coordinates.",
    invariants: [
        "A word found in the book maps to the coordinates of its first occurrence.",
        "Words absent from the book are sent with a literal marker.",
        "Decoding resolves each coordinate back to the same book word.",
    ],
    correctness:
        "The lookup records the first occurrence of each normalized word, so encoding is deterministic and repeatable. A coordinate (line, word) always points to the exact word used to create it, because the same book is used on both sides. Literal markers carry words that do not occur in the book unchanged through the round trip. Therefore decode(encode(text)) reproduces the original words.",
    complexityRationale:
        "Indexing visits every book word once, O(b), and encoding or decoding processes each message word once, O(n). The lookup table and the displayed tokens use O(b + n) space.",
    uses: [
        "Historical espionage and one-time-book messaging",
        "Teaching lookup-based ciphers and shared keys",
        "Understanding why key distribution matters in cryptography",
    ],
    references: [
        "Kahn, The Codebreakers",
        "Wikipedia, Book cipher",
    ],
    workedExample:
        "If the book's first line is 'THE ATTACK WILL BEGIN AT DAWN', the word ATTACK is at line 1, word 2, and encodes as 1.2. Decoding 1.2 returns ATTACK.",
    },
    id: "book-cipher",
    name: "Book Cipher (Coordinate Lookup)",
    category: "cryptography-security",
    complexity: { time: "O(b + n)", space: "O(b + n)" },
    defaultInput: {
        text: "ATTACK AT DAWN",
        book: [
            "THE ATTACK WILL BEGIN AT DAWN",
            "BRING ALL TROOPS TO THE EAST WALL",
            "WAIT FOR THE SIGNAL BEFORE MOVING",
        ],
        mode: "encode",
    },
    visualType: "text",
    run,
    pseudocode: [
        "read the message, the book lines and the direction",
        "index each book word by its first line and word position",
        "for encoding, replace each word with its coordinates",
        "mark words that are not in the book as literals",
        "for decoding, look up each coordinate in the book",
        "restore literal-marked words unchanged",
        "done: return the transformed message",
    ],
};

export default module;
