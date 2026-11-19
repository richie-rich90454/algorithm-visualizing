/**
 * skip-search.ts - Skip Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Skip Search is an exact string-matching algorithm based on a distinguished
 * position k of the pattern. It records, for each character, the pattern
 * positions at or after k that hold that character. As the text is scanned,
 * only those recorded positions are tried as candidate alignments, so most
 * text positions are skipped without any pattern comparison at all.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m + n * |positions(text[i])|) average; O(nm) worst case
 *   Space: O(m + sigma) for the position table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The scanned text character is orange (comparing).
 *   - A candidate alignment window is yellow (highlight).
 *   - A confirmed match is green (sorted).
 *   - Character positions that produced no candidate stay idle.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SkipTask {
    text?: string;
    pattern?: string;
}

function makeCharacters(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return [...text].map((character, index) => ({
        id: `char-${index}`,
        type: "character" as const,
        label: character,
        value: character,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SkipTask | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "ababcabcabababc";
    const pattern = typeof task.pattern === "string" ? task.pattern : "abc";
    const chars = [...text];
    const pat = [...pattern];
    const n = chars.length;
    const m = pat.length;

    let step = 0;
    let comparisons = 0;
    let candidates = 0;
    let frames = 0;

    const emit = (
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCharacters(text, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "text",
        meta: { pattern, comparisons, candidates, n, m, ...extra },
    });

    yield emit(new Map(), `Skip search for "${pattern}" in a text of ${n} character(s).`, 0, { matches: [] });
    step += 1;
    frames += 1;

    if (m === 0 || n < m) {
        yield emit(new Map(), m === 0 ? "An empty pattern matches nothing." : "The pattern is longer than the text.", 6, {
            matches: [],
        });
        return;
    }

    const k = Math.floor(m / 2);
    const positions = new Map<string, number[]>();
    for (let j = k; j < m; j += 1) {
        const character = pat[j] as string;
        if (!positions.has(character)) positions.set(character, []);
        (positions.get(character) as number[]).push(j);
    }
    yield emit(
        new Map(),
        `Distinguished position k=${k}; table has ${positions.size} character(s).`,
        1,
        { matches: [], k },
    );
    step += 1;
    frames += 1;

    const matches = new Set<number>();
    for (let i = k; i < n; i += 1) {
        const character = chars[i] as string;
        const offsets = positions.get(character) ?? [];
        if (offsets.length === 0) continue;

        for (const j of offsets) {
            const start = i - j;
            if (start < 0 || start + m > n) continue;
            candidates += 1;

            const window = new Map<number, EntityState>();
            for (let t = start; t < start + m; t += 1) window.set(t, "highlight");
            window.set(i, "comparing");
            if (frames < 40) {
                yield emit(
                    window,
                    `Text[${i}]='${character}' suggests an alignment starting at ${start}.`,
                    2,
                    { matches: [...matches], k },
                );
                step += 1;
                frames += 1;
            }

            let equal = true;
            for (let t = 0; t < m; t += 1) {
                comparisons += 1;
                if (chars[start + t] !== pat[t]) {
                    equal = false;
                    break;
                }
            }
            if (equal) {
                matches.add(start);
                const found = new Map<number, EntityState>();
                for (let t = start; t < start + m; t += 1) found.set(t, "sorted");
                if (frames < 40) {
                    yield emit(found, `Verified a full match of "${pattern}" at index ${start}.`, 3, {
                        matches: [...matches].sort((a, b) => a - b),
                        k,
                    });
                    step += 1;
                    frames += 1;
                }
            }
        }
    }

    const finalStates = new Map<number, EntityState>();
    for (const start of matches) {
        for (let t = start; t < start + m; t += 1) finalStates.set(t, "sorted");
    }
    yield emit(
        finalStates,
        matches.size > 0
            ? `Found ${matches.size} match(es) at ${[...matches].sort((a, b) => a - b).join(", ")}.`
            : `"${pattern}" does not occur in the text.`,
        6,
        { matches: [...matches].sort((a, b) => a - b), comparisons, candidates, k },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Choose one distinguished position k inside the pattern and build a table that maps each character to the pattern offsets at or after k where that character appears. As the text is scanned, look up the current character and try only those offsets. A real match must put the distinguished pattern character against the current text character, so no occurrence can be missed.",
        invariants: [
            "Every offset stored in the table points to a pattern position holding that character.",
            "If a match starts at s, then for i = s + k the offset k is in the table entry for text[i].",
            "A recorded match passes a full character-by-character verification.",
        ],
        correctness:
            "Consider any occurrence of the pattern starting at s. At text position i = s + k the character equals pattern[k], and k is stored in that character's offset list, so the algorithm tries offset k and derives start = i - k = s. Thus every occurrence is generated and verified; verification confirms it, so the reported matches are exactly the occurrences.",
        complexityRationale:
            "Building the table costs O(m). Each of the n text positions looks up one character and tries only the stored offsets for it; a verification costs O(m), giving O(nm) worst case but far less on typical text with a sparse table. Space is O(m + sigma).",
        uses: [
            "Exact substring search with very few candidate alignments",
            "A teaching bridge between Boyer-Moore and hashing-based filters",
            "Scanning streams where most characters cannot start a match",
        ],
        references: [
            "Amir, Lewenstein and Porat, Skip Search, 2004",
            "Crochemore and Rytter, Jewels of Stringology, Chapter on pattern matching",
        ],
        workedExample:
            "For pattern abc of length 3, k = 1 and the table stores a at offset 1, b at offset 1, c at offset 2. Scanning abcabc, text[1]='b' suggests start 0 and text[2]='c' suggests start 0 again; both verify to a match at 0, which is reported once.",
    },
    id: "skip-search",
    name: "Skip Search",
    category: "searching",
    complexity: { time: "O(nm) worst case", space: "O(m + sigma)" },
    defaultInput: { text: "ababcabcabababc", pattern: "abc" },
    visualType: "text",
    run,
    pseudocode: [
        "choose the distinguished position k in the pattern",
        "map each pattern character at or after k to its offsets",
        "scan the text from position k onward",
        "look up the current character's offsets and try each one",
        "verify a candidate by comparing the whole window",
        "record each verified starting position once",
        "done: report all occurrences of the pattern",
    ],
};

export default module;
