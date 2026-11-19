/**
 * main-lorentz-repetitions.ts - Main-Lorentz Repetition Finding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A repetition (tandem repeat, or square) is a substring of the form X X for
 * a nonempty string X. The Main-Lorentz divide-and-conquer algorithm finds
 * every repetition in a text: split the range at a midpoint, recurse on the
 * two halves, and enumerate squares that straddle the midpoint. A square with
 * boundary j and period p straddles the midpoint when p is larger than the
 * distance from j to the midpoint, and it is valid exactly when the p
 * characters before j equal the p characters after j, which a longest-common-
 * suffix table answers in constant time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 + n^3 log n) with an O(n^2) suffix table and this crossing scan
 *   Space: O(n^2) for the longest-common-suffix table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Characters are shown in a text layout.
 *   - The two copies of the repetition currently being checked are GREEN
 *     (sorted) and YELLOW (comparing); the rest are idle.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    s?: string;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const s = typeof task.s === "string" ? task.s : "abababa";
    const n = Math.min(s.length, 40);
    const text = s.slice(0, n);
    const chars = [...text];

    // lcs[i][j] = length of the longest common suffix of text[0..i] and
    // text[0..j]. This gives constant-time left-extension queries.
    const lcs: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            if (chars[i] === chars[j]) lcs[i]![j] = (i > 0 && j > 0 ? lcs[i - 1]![j - 1] ?? 0 : 0) + 1;
        }
    }

    const found = new Map<string, { start: number; period: number }>();
    const pending: Array<{ start: number; period: number; mid: number }> = [];

    const divide = (lo: number, hi: number): void => {
        if (hi - lo < 2) return;
        const mid = Math.floor((lo + hi) / 2);
        for (let j = lo; j < hi; j += 1) {
            const minPeriod = Math.abs(j - mid) + 1;
            const maxPeriod = Math.min(j - lo, hi - j);
            for (let p = minPeriod; p <= maxPeriod; p += 1) {
                const leftEnd = j - 1;
                const rightEnd = j + p - 1;
                if (leftEnd < 0 || rightEnd >= n) continue;
                if ((lcs[leftEnd]?.[rightEnd] ?? 0) >= p) {
                    const key = `${j - p}:${p}`;
                    if (!found.has(key)) {
                        found.set(key, { start: j - p, period: p });
                        pending.push({ start: j - p, period: p, mid });
                    }
                }
            }
        }
        divide(lo, mid);
        divide(mid, hi);
    };
    divide(0, n);

    const makeChars = (start: number, period: number): VisualEntity[] =>
        chars.map((ch, index) => {
            let state: EntityState = "idle";
            if (start >= 0 && period > 0) {
                if (index >= start && index < start + period) state = "sorted";
                else if (index >= start + period && index < start + 2 * period) state = "comparing";
            }
            return {
                id: `char-${index}`,
                type: "character" as const,
                label: ch,
                value: ch,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index, char: ch },
            };
        });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeChars(-1, 0),
        edges: [],
        description: `Find every repetition XX in "${text}" by divide and conquer.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { phase: "setup", text, repetitions: "", count: 0 },
    };
    step += 1;

    for (const item of pending.slice(0, 40)) {
        yield {
            stepNumber: step,
            entities: makeChars(item.start, item.period),
            edges: [],
            description: `Found repetition "${text.slice(item.start, item.start + item.period)}" twice starting at ${item.start}, period ${item.period}.`,
            codeLineNumber: 3,
            layout: "text",
            meta: { phase: "found", text, repetitions: [...found.keys()].join(" "), count: found.size, start: item.start, period: item.period },
        };
        step += 1;
    }

    const repetitions = [...found.values()]
        .sort((a, b) => a.start - b.start || a.period - b.period)
        .map((r) => `${r.start}:${r.period}`)
        .join(" ");
    yield {
        stepNumber: step,
        entities: makeChars(-1, 0),
        edges: [],
        description: `Found ${found.size} repetition(s) in "${text}".`,
        codeLineNumber: 7,
        layout: "text",
        meta: { phase: "done", text, repetitions, count: found.size },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A repetition is two identical blocks written back to back, such as 'abab'. Divide the text in half and look for repetitions entirely in each half, plus the ones that straddle the midpoint. A straddling repetition has a boundary between its two copies; comparing the characters to the left of that boundary with the characters to its right tells, in one lookup, whether a given block length works.",
        invariants: [
            "Each reported substring consists of two adjacent identical blocks.",
            "A repetition is recorded only at the recursion level whose midpoint lies strictly inside it.",
            "The longest-common-suffix table gives the exact number of matching characters extending leftward from any pair of positions.",
        ],
        correctness:
            "Every repetition has a boundary j and period p, and it is valid exactly when the p characters before j match the p characters after j, which the suffix table tests exactly. At the topmost recursion range whose midpoint lies strictly between j-p and j+p, the loop considers that (j, p) pair because p exceeds the midpoint distance and fits inside the range, so the repetition is recorded. No other level records it because a sibling range cannot contain the whole substring. Hence the output is exactly the set of all repetitions, each once.",
        complexityRationale:
            "Building the suffix table costs O(n^2). At each of O(log n) recursion levels the crossing scan considers O(n^2) (boundary, period) pairs, so the total is O(n^3 log n) with this direct implementation. The suffix table and the result set use O(n^2) space.",
        uses: [
            "Detecting tandem repeats in DNA and protein sequences",
            "Text compression schemes that exploit repeated substrings",
            "Analyzing periodicity in strings and Lyndon factorization",
        ],
        references: [
            "Main and Lorentz, An O(n log n) Algorithm for Finding All Repetitions in a String, 1984",
            "Gusfield, Algorithms on Strings, Trees, and Sequences, Chapter 8",
        ],
        workedExample:
            "In 'abababa', starting at 0 with period 2 gives 'ab' followed by 'ab', a repetition; starting at 0 with period 4 gives 'abab' followed by 'abab'. The boundary for the first is at index 2, and the two characters before it match the two after it, so the suffix table confirms period 2.",
    },
    id: "main-lorentz-repetitions",
    name: "Main-Lorentz Repetition Finding",
    category: "string",
    complexity: { time: "O(n^3 log n)", space: "O(n^2)" },
    defaultInput: { s: "abababa" },
    visualType: "text",
    run,
    pseudocode: [
        "build the longest-common-suffix table for the text",
        "split the current range at its midpoint",
        "for each boundary in the range",
        "for each period that straddles the midpoint",
        "if the two blocks match, record the repetition",
        "recurse on the left and right halves",
        "collect every distinct repetition found",
        "done: report the repetitions and their count",
    ],
};

export default module;
