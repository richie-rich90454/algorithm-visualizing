/**
 * lowrance-wagner-algorithm.ts - Lowrance-Wagner Shortest Common Supersequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Lowrance-Wagner algorithm finds a shortest common supersequence of k
 * strings. It explores the lattice of k-tuples of cursor positions: from a
 * tuple, choosing a character advances every string whose current character
 * matches it. Because cursors only move forward the state graph is acyclic, so
 * dynamic programming over the tuples gives the shortest supersequence and its
 * reconstruction. For k equals two it matches the familiar LCS-based formula.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * |alphabet| * product of (length_t + 1))
 *   Space: O(product of (length_t + 1)) for the memo table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid row is one input string; green cells are already consumed.
 *   - The next cursor character in each string is YELLOW.
 *   - meta carries the cursors and the supersequence built so far.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(strings: string[], positions: number[], cols: number): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let t = 0; t < strings.length; t += 1) {
        for (let p = 0; p < cols; p += 1) {
            const ch = strings[t]?.[p];
            let state: EntityState = "idle";
            if (ch !== undefined && p < (positions[t] ?? 0)) {
                state = "sorted";
            } else if (ch !== undefined && p === (positions[t] ?? 0)) {
                state = "comparing";
            }
            cells.push({
                id: `cell-${t}-${p}`,
                type: "cell",
                label: ch ?? "",
                value: ch ?? "",
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: t, col: p },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { strings?: string[] } | null) ?? {};
    const raw = Array.isArray(task.strings) && task.strings.length > 0 ? task.strings : ["ab", "ba", "aba"];
    const strings = raw.map((value) => (typeof value === "string" ? value : String(value)));
    const k = strings.length;
    const lengths = strings.map((value) => value.length);
    const cols = Math.max(0, ...lengths);
    const alphabet = Array.from(new Set(strings.join("").split(""))).sort();
    const start = Array<number>(k).fill(0);

    const memo = new Map<string, number>();
    const choice = new Map<string, string>();
    const keyOf = (positions: number[]): string => positions.join(",");

    const solve = (positions: number[]): number => {
        const key = keyOf(positions);
        const cached = memo.get(key);
        if (cached !== undefined) {
            return cached;
        }
        if (positions.every((p, t) => p >= (lengths[t] ?? 0))) {
            memo.set(key, 0);
            return 0;
        }
        const fronts = new Set<string>();
        for (let t = 0; t < k; t += 1) {
            const p = positions[t] ?? 0;
            const ch = strings[t]?.[p];
            if (ch !== undefined) {
                fronts.add(ch);
            }
        }
        let best = Infinity;
        let bestChar = "";
        for (const ch of fronts.size > 0 ? Array.from(fronts).sort() : alphabet) {
            const next = positions.map((p, t) => (strings[t]?.[p] === ch ? p + 1 : p));
            if (keyOf(next) === key) {
                continue;
            }
            const candidate = 1 + solve(next);
            if (candidate < best) {
                best = candidate;
                bestChar = ch;
            }
        }
        if (!Number.isFinite(best)) {
            best = 0;
        }
        memo.set(key, best);
        choice.set(key, bestChar);
        return best;
    };

    const length = solve(start);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(strings, start, cols),
        edges: [],
        description: `Shortest common supersequence of ${k} strings by Lowrance-Wagner DP.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: k, cols, k, strings: strings.join("|"), positions: [...start], scsSoFar: "", length },
    };
    step += 1;

    const built: string[] = [];
    let cursor = [...start];
    while (!cursor.every((p, t) => p >= (lengths[t] ?? 0))) {
        const key = keyOf(cursor);
        const ch = choice.get(key) ?? "";
        if (ch === "") {
            break;
        }
        built.push(ch);
        cursor = cursor.map((p, t) => (strings[t]?.[p] === ch ? p + 1 : p));
        yield {
            stepNumber: step,
            entities: makeCells(strings, cursor, cols),
            edges: [],
            description: `Chose '${ch}', advancing the matching cursor(s); supersequence so far "${built.join("")}".`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: k, cols, k, strings: strings.join("|"), positions: [...cursor], scsSoFar: built.join(""), length },
        };
        step += 1;
    }

    const scs = built.join("");
    yield {
        stepNumber: step,
        entities: makeCells(strings, cursor, cols),
        edges: [],
        description: `Shortest common supersequence is "${scs}" with length ${scs.length}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: k, cols, k, strings: strings.join("|"), positions: [...cursor], scs, length: scs.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A supersequence must contain every input string in order. Picture one cursor per string at its first unconsumed character. At each step pick a character and advance every cursor that currently points at it; a cursor that does not match simply waits. Dynamic programming over all cursor positions remembers the shortest completion from each state, so shared prefixes are written only once.",
        invariants: [
            "Cursors only move forward, so the state graph is acyclic.",
            "Each recorded choice advances at least one string's cursor.",
            "The value of a state is the length of the shortest supersequence of the remaining suffixes.",
        ],
        correctness:
            "Any common supersequence begins with a character that is the current character of at least one string, and choosing it moves exactly those cursors. The recurrence takes the minimum over all such choices of one plus the optimal value of the resulting state, which is optimal by induction on the remaining total length because cursors only advance. Reconstructing the chosen characters therefore yields a shortest common supersequence.",
        complexityRationale:
            "There is one state per k-tuple of cursor positions, at most the product of the string lengths plus one. Each state tries at most the alphabet size of candidate characters, so time is O(k times alphabet times the state count) and the memo table uses space proportional to that state count.",
        uses: [
            "Merging multiple ordered logs into one minimal event sequence",
            "Genome assembly from overlapping reads",
            "Combining test sequences while preserving each order",
        ],
        references: [
            "Lowrance and Wagner, An Extension of the String-to-String Correction Problem, 1975",
            "Gusfield, Algorithms on Strings, Trees, and Sequences, Chapter 12",
        ],
        workedExample:
            "For the strings ab, ba, and aba, the DP starts with all cursors at zero. Choosing a advances the first and third strings; choosing b then advances the second. Continuing the greedy-optimal choices builds a shortest string such as ababa that contains all three inputs as subsequences.",
    },
    id: "lowrance-wagner-algorithm",
    name: "Lowrance-Wagner Algorithm",
    category: "dynamic-programming",
    complexity: { time: "O(k * |alphabet| * product(lengths))", space: "O(product(lengths))" },
    defaultInput: { strings: ["ab", "ba", "aba"] },
    visualType: "grid",
    run,
    pseudocode: [
        "list the input strings and their first cursor positions",
        "define a state as the tuple of all cursor positions",
        "for each state collect the characters at the active cursors",
        "for each candidate character advance every matching cursor",
        "memoize one plus the minimum completion length over candidates",
        "reconstruct by following the recorded best character per state",
        "done: report the shortest common supersequence and its length",
    ],
};

export default module;
