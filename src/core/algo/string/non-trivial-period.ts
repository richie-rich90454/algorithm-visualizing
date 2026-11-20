/**
 * non-trivial-period.ts - Non-Trivial Periods via the Prefix Function
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A period of a string is a shift p such that every character equals the one p
 * positions later. The module runs the Knuth-Morris-Pratt prefix function over
 * the text, then follows the chain of proper borders. Each border of length b
 * yields the period n minus b, so the whole set of non-trivial periods is found
 * in linear time after the prefix table is built.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a string of length n
 *   Space: O(n) for the prefix table and displayed characters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The characters of the text are shown in the text layout.
 *   - The character whose prefix value is being computed is YELLOW.
 *   - Characters inside the shortest period are GREEN in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "abababab";
    const n = text.length;
    const pi: number[] = Array<number>(n).fill(0);

    const render = (states: Map<number, EntityState>, step: number, description: string, codeLineNumber: number, extra: Record<string, number | string | boolean | number[]> = {}): VisualFrame => ({
        stepNumber: step,
        entities: makeCharacters(text, "text").map((entity) => {
            const index = Number(entity.metadata["index"]);
            return { ...entity, state: (states.get(index) ?? "idle") as EntityState };
        }),
        edges: [],
        description,
        codeLineNumber,
        layout: "text",
        meta: { n, pi: [...pi], periods: [], minimalPeriod: 0, ...extra },
    });

    yield render(new Map(), 0, `Finding the non-trivial periods of "${text}" with the prefix function.`, 0);
    let step = 1;

    for (let i = 1; i < n; i += 1) {
        let j = pi[i - 1] ?? 0;
        while (j > 0 && text[i] !== text[j]) j = pi[j - 1] ?? 0;
        if (text[i] === text[j]) j += 1;
        pi[i] = j;
        yield render(new Map([[i, "comparing"]]), step, `Prefix value at index ${i} is ${j}: the longest proper prefix ending there is also a suffix.`, 3, { pi: [...pi] });
        step += 1;
    }

    const periods: number[] = [];
    let border = n > 0 ? pi[n - 1] ?? 0 : 0;
    while (border > 0) {
        const period = n - border;
        if (period > 0 && period < n && !periods.includes(period)) periods.push(period);
        border = pi[border - 1] ?? 0;
    }
    periods.sort((a, b) => a - b);

    const shortest = periods[0] ?? 0;
    const green = new Map<number, EntityState>();
    if (shortest > 0) {
        for (let i = 0; i < shortest; i += 1) green.set(i, "sorted");
    }
    yield render(green, step, `Border chain yields periods ${periods.join(", ") || "none"}; shortest is ${shortest || "none"}.`, 6, { periods, minimalPeriod: shortest });
}

/** The non-trivial period module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A string repeats with period p when shifting it by p leaves it unchanged. Instead of testing every shift, the Knuth-Morris-Pratt prefix table records for each position how much of the beginning matches the ending. Those matching lengths are border lengths, and a border of length b means the string repeats with period n minus b.",
        invariants: [
            "Each prefix value is the length of the longest proper prefix that is also a suffix.",
            "Every border in the chain is strictly shorter than the previous one.",
            "Each reported period is between one and n minus one.",
        ],
        correctness:
            "The prefix function is computed by the standard KMP recurrence, so pi at the last index is the longest border length. Following pi from a border length to the next gives the full chain of proper borders because each shorter border is itself the longest border of the border string. A border of length b implies the first n minus b characters equal the last n minus b characters, which is exactly the condition for period n minus b; collecting all borders therefore collects every period, and brute-force comparison confirms each one.",
        complexityRationale:
            "The KMP prefix table takes O(n) time because the inner while loop decreases j overall at most n times, and following the border chain visits at most n borders, giving linear time and O(n) space for the table and characters.",
        uses: [
            "Detecting tandem repeats in DNA sequences",
            "Checking whether a token pattern repeats in compression algorithms",
            "Finding the fundamental frequency of a repeated signal pattern",
        ],
        references: [
            "Knuth, Morris, and Pratt, Fast Pattern Matching in Strings, 1977",
            "Gusfield, Algorithms on Strings, Trees and Sequences, Chapter 1",
        ],
        workedExample:
            "For ababab, the prefix table ends at 4, meaning the border abab has length four. The border chain continues to ab with length two, producing periods two and four. Direct checking confirms that shifting by two or by four leaves the string unchanged.",
    },
    id: "non-trivial-period",
    name: "Non-Trivial Periods",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "abababab" },
    visualType: "text",
    run,
    pseudocode: [
        "read the text and initialize the prefix table with zeros",
        "for each index from one to n minus one set j to the previous prefix value",
        "while j is positive and the characters differ fall back to the prefix value at j minus one",
        "if the characters match increase j and store it as the prefix value",
        "start from the last prefix value as the longest border length",
        "while the border is positive add n minus it as a period and follow its own prefix value",
        "done: report the sorted non-trivial periods and the shortest one",
    ],
};

export default module;
