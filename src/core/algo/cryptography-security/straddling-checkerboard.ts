/**
 * straddling-checkerboard.ts - Straddling Checkerboard Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A straddling checkerboard maps frequent letters to single digits and all
 * other letters to two digits. Eight common letters occupy the top row of a
 * digit grid; the two unused digit positions become row markers for two lower
 * rows holding the remaining eighteen letters. Encoding a letter therefore
 * emits one or two digits. Decoding reads one digit and, when it is a row
 * marker, consumes one more to select the column.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a message of n letters
 *   Space: O(n) for the displayed characters and the digit string
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character entity per input letter.
 *   - The active letter is highlighted with its digit code.
 *   - The final frame reports the full digit string and its decoded form.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "encode" | "decode";

const TOP: Record<string, string> = {
    E: "1",
    T: "2",
    A: "4",
    O: "5",
    I: "6",
    N: "7",
    S: "8",
    R: "0",
};
const MARKERS = new Set(["3", "9"]);

/** The two lower rows as fixed ten-column strings. */
const LOWER: Record<string, string> = {
    "3": "BCDFGHJKLM",
    "9": "PQUVWXYZ--",
};

/** Map a single letter to its digit string. */
function encodeLetter(letter: string): string {
    const top = TOP[letter];
    if (top) return top;
    for (const marker of ["3", "9"]) {
        const row = LOWER[marker] as string;
        const col = row.indexOf(letter);
        if (col >= 0) return marker + String(col);
    }
    return "";
}

/** Decode a digit stream back into letters. */
function decodeDigits(digits: string): string {
    const out: string[] = [];
    for (let i = 0; i < digits.length; ) {
        const first = digits[i] as string;
        if (MARKERS.has(first)) {
            const second = digits[i + 1];
            if (second === undefined) break;
            const row = LOWER[first] as string;
            const letter = row[Number(second)];
            out.push(letter && letter !== "-" ? letter : "?");
            i += 2;
        } else {
            const found = Object.keys(TOP).find((letter) => TOP[letter] === first);
            out.push(found ?? "?");
            i += 1;
        }
    }
    return out.join("");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; mode?: Mode } | null) ?? {};
    const mode: Mode = task.mode === "decode" ? "decode" : "encode";
    const text = typeof task.text === "string" ? task.text : "ATTACKATDAWN";
    const letters = [...text]
        .map((ch) => ch.toUpperCase())
        .filter((ch) => (ch >= "A" && ch <= "Z") || (ch >= "0" && ch <= "9"));
    const states = new Map<number, EntityState>();
    let output = "";
    const built: string[] = [];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: letters.map((ch, index) => ({
            id: `char-${index}`,
            type: "character" as const,
            label: ch,
            value: ch,
            state: "idle" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, output: "" },
        })),
        edges: [],
        description: `${mode === "encode" ? "Encoding" : "Decoding"} ${letters.length} letter(s) with a straddling checkerboard.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { mode, output: "", input: text, phase: "start" },
    };

    if (mode === "encode") {
        for (let i = 0; i < letters.length; i += 1) {
            const ch = letters[i] as string;
            built.push(encodeLetter(ch));
            output = built.join(" ");
            states.clear();
            states.set(i, "active");
            yield {
                stepNumber: step++,
                entities: letters.map((ch2, index) => ({
                    id: `char-${index}`,
                    type: "character" as const,
                    label: ch2,
                    value: ch2,
                    state: states.get(index) ?? "idle",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { index, output: built[index] ?? "" },
                })),
                edges: [],
                description: `Letter ${ch} maps to digit code ${encodeLetter(ch)}.`,
                codeLineNumber: 3,
                layout: "text",
                meta: { mode, output, input: text, phase: "step", index: i },
            };
        }
        output = built.join(" ");
    } else {
        const digits = letters
            .map((ch) => (ch >= "0" && ch <= "9" ? ch : ""))
            .join("");
        output = decodeDigits(digits);
        states.set(0, "active");
        yield {
            stepNumber: step++,
            entities: letters.map((ch, index) => ({
                id: `char-${index}`,
                type: "character" as const,
                label: ch,
                value: ch,
                state: "active" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index, output: output[index] ?? "" },
            })),
            edges: [],
            description: `Read the digit stream ${digits} into letters: ${output}.`,
            codeLineNumber: 6,
            layout: "text",
            meta: { mode, output, input: text, phase: "step" },
        };
        void states;
    }

    yield {
        stepNumber: step++,
        entities: letters.map((ch, index) => ({
            id: `char-${index}`,
            type: "character" as const,
            label: ch,
            value: ch,
            state: "sorted" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, output: output[index] ?? "" },
        })),
        edges: [],
        description: `Straddling checkerboard ${mode} complete: "${output}".`,
        codeLineNumber: 6,
        layout: "text",
        meta: { mode, output, input: text, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Give the most common letters a single-digit code and the rest a two-digit code. The trick is that two of the single digits are reused as row labels: seeing one tells you the next digit chooses a letter from a lower row. Frequent letters cost one digit, uncommon ones cost two, which keeps messages short while remaining easy to decode.",
        invariants: [
            "Each letter has a unique digit code under this fixed board.",
            "A two-digit code always begins with one of the two row marker digits.",
            "Decoding the digits of an encoded letter returns that letter.",
        ],
        correctness:
            "The board is a prefix-free code: single-digit codes are the eight non-marker digits and two-digit codes always start with a marker digit. When decoding, a non-marker digit uniquely identifies a top-row letter, while a marker digit unambiguously signals that one more digit selects a lower-row letter. Since no valid code is a prefix of another, the digit stream parses uniquely and decode(encode(text)) returns the original letters.",
        complexityRationale:
            "Encoding a letter scans at most two ten-character rows and decoding consumes one or two digits, so both directions are O(n) for n letters. The output and display use O(n) space.",
        uses: [
            "Teaching variable-length codes and prefix-free parsing",
            "Historical numeric ciphers such as the VIC cipher",
            "compressing letters by giving common symbols shorter codes",
        ],
        references: [
            "Kahn, The Codebreakers",
            "Wikipedia, Straddling checkerboard",
        ],
        workedExample:
            "On this board E is 1, T is 2, and B is 30 (row marker 3, column 0). The letters E, T, B encode to 1 2 30, and reading those digits back recovers E, T, B.",
    },
    id: "straddling-checkerboard",
    name: "Straddling Checkerboard Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "ATTACKATDAWN", mode: "encode" },
    visualType: "text",
    run,
    pseudocode: [
        "read the message and the direction",
        "use a fixed board with single-digit top-row letters",
        "for encoding, replace each letter with one or two digits",
        "use a row marker when the letter lives in a lower row",
        "for decoding, read one digit and detect a row marker",
        "if it is a marker, consume one more digit for the column",
        "done: return the transformed message",
    ],
};

export default module;
