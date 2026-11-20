/**
 * front-coding.ts - Front Coding Compression for Sorted Strings
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Front coding exploits the fact that lexically sorted strings cluster by
 * common prefixes. Each entry is stored as the length of the prefix it shares
 * with the previous entry followed by only the remaining suffix. Dictionaries
 * and inverted indexes use this to store millions of sorted terms in a fraction
 * of their original space.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(total characters) - each prefix is scanned once
 *   Space: O(total characters) for the stored suffixes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row is one term: shared-prefix length, stored suffix, full term.
 *   - The suffix cell is yellow, the reconstructed term is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface FrontEntry {
    prefix: number;
    suffix: string;
}

/** Length of the longest common prefix of two strings. */
export function commonPrefixLength(a: string, b: string): number {
    const limit = Math.min(a.length, b.length);
    let length = 0;
    while (length < limit && a[length] === b[length]) {
        length += 1;
    }
    return length;
}

/** Front-code a lexically sorted list of words. */
export function frontCode(words: string[]): FrontEntry[] {
    const entries: FrontEntry[] = [];
    let previous = "";
    for (const word of words) {
        const prefix = commonPrefixLength(previous, word);
        entries.push({ prefix, suffix: word.slice(prefix) });
        previous = word;
    }
    return entries;
}

/** Rebuild the original word list from front-coded entries. */
export function frontDecode(entries: FrontEntry[]): string[] {
    const words: string[] = [];
    let previous = "";
    for (const entry of entries) {
        const word = previous.slice(0, entry.prefix) + entry.suffix;
        words.push(word);
        previous = word;
    }
    return words;
}

function encodeEntry(entry: FrontEntry): string {
    return `${entry.prefix}:${entry.suffix}`;
}

function makeCells(words: string[], entries: FrontEntry[], activeRow: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const decoded = frontDecode(entries);
    words.forEach((_word, row) => {
        const entry = entries[row] ?? { prefix: 0, suffix: "" };
        const full = decoded[row] ?? "";
        const columns: Array<[string, string, number | string]> = [
            ["prefix", String(entry.prefix), entry.prefix],
            ["suffix", entry.suffix === "" ? "(empty)" : entry.suffix, entry.suffix],
            ["full word", full, full],
        ];
        columns.forEach(([role, label, value], col) => {
            let state: EntityState = "idle";
            if (col === 0) state = "comparing";
            if (col === 1) state = "active";
            if (col === 2) state = "sorted";
            if (row === activeRow && col === 1) state = "comparing";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, role, prefix: entry.prefix, suffix: entry.suffix },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { words?: string[] } | null) ?? {};
    const words = Array.isArray(task.words) && task.words.length > 0
        ? [...task.words]
        : ["cat", "catalog", "category", "cater", "dog", "dogma", "door", "doors"];
    const entries = frontCode(words);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(words, [], -1),
        edges: [],
        description: `Front coding ${words.length} sorted term(s); each row stores shared prefix length and suffix.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: words.length, cols: 3, words: [...words], encoded: [] as string[] },
    };
    step += 1;

    for (let row = 0; row < words.length; row += 1) {
        const entry = entries[row]!;
        yield {
            stepNumber: step,
            entities: makeCells(words, entries.slice(0, row + 1), row),
            edges: [],
            description: `Term ${row}: "${words[row]}" shares ${entry.prefix} char(s) with the previous term; store suffix "${entry.suffix}".`,
            codeLineNumber: entry.prefix > 0 ? 2 : 3,
            layout: "grid",
            meta: {
                rows: words.length,
                cols: 3,
                words: [...words],
                encoded: entries.slice(0, row + 1).map(encodeEntry),
                activeRow: row,
            },
        };
        step += 1;
    }

    const storedChars = entries.reduce((sum, entry) => sum + entry.suffix.length, 0);
    const originalChars = words.reduce((sum, word) => sum + word.length, 0);
    yield {
        stepNumber: step,
        entities: makeCells(words, entries, -1),
        edges: [],
        description: `Stored ${storedChars} suffix character(s) instead of ${originalChars}; decoding restores all ${words.length} terms.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: words.length,
            cols: 3,
            words: [...words],
            encoded: entries.map(encodeEntry),
            decoded: frontDecode(entries),
            storedChars,
            originalChars,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Sorted words that start with the same letters waste space repeating that prefix. Front coding writes down how many characters a word shares with the word before it, then writes only the leftover suffix. The first word stores everything; each later word often stores just a few characters.",
        invariants: [
            "Each stored prefix length never exceeds the length of the previous word.",
            "The stored suffix is exactly the current word with that prefix removed.",
            "Decoding reconstructs the original sorted list entry by entry.",
        ],
        correctness:
            "For word i, the encoder records the longest common prefix p with word i-1 and the remaining suffix. Because the list is sorted, equal-prefix terms are adjacent, so p is as large as possible. The decoder rebuilds word i from the first p characters of the already-decoded word i-1 followed by the stored suffix, which is precisely the original word by construction. Induction over the rows proves the whole list is restored.",
        complexityRationale:
            "Computing each prefix length scans at most the shorter of two neighboring words, and each stored suffix is copied once, so total work is linear in the total number of characters. The encoded output stores only suffixes and small integer prefixes, so space is also linear in the character count.",
        uses: [
            "Compressing term dictionaries in search-engine inverted indexes",
            "Storing sorted keys in columnar and log-structured databases",
            "Shrinking word lists in dictionary and spell-check data files",
        ],
        references: [
            "Witten, Moffat, and Bell, Managing Gigabytes, 1999",
            "Zobel and Moffat, Inverted Files for Text Search Engines, 2006",
        ],
        workedExample:
            "For the sorted terms cat, catalog, category, the first entry stores prefix 0 and suffix cat. The second shares the three characters cat with the first, so it stores prefix 3 and suffix alog. The third shares five characters, catalog, so it stores prefix 5 and suffix y. Reconstructing each term from the previous one recovers the original list exactly.",
    },
    id: "front-coding",
    name: "Front Coding Compression",
    category: "production-systems",
    complexity: { time: "O(total characters)", space: "O(total characters)" },
    defaultInput: { words: ["cat", "catalog", "category", "cater", "dog", "dogma", "door", "doors"] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty encoded list and an empty previous word",
        "for each word in the sorted list",
        "count the prefix shared with the previous word",
        "store that count and the remaining suffix",
        "set the previous word to the current word",
        "done: report the encoded entries and verify decoding",
    ],
};

export default module;
