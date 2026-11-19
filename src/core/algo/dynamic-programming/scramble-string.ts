/**
 * scramble-string.ts - Scramble String Check
 *
 * A string is a scramble of another when it can be produced by recursively
 * cutting a substring into two parts and optionally swapping them. The test
 * tries every split and both orientations, pruning a branch immediately when
 * the two substrings do not contain the same multiset of characters. Memoizing
 * substring pairs avoids recomputing the same decision many times.
 *
 * Time: exponential in the string length, reduced by memoization
 * Space: O(n^3) for the memoized substring-pair decisions
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ScrambleInput {
    s1: string;
    s2: string;
}

interface Record {
    a: string;
    b: string;
    result: boolean;
}

function sameLetters(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }
    const count = new Map<string, number>();
    for (const char of a) {
        count.set(char, (count.get(char) ?? 0) + 1);
    }
    for (const char of b) {
        const left = (count.get(char) ?? 0) - 1;
        if (left < 0) {
            return false;
        }
        count.set(char, left);
    }
    return true;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<ScrambleInput> | null) ?? {};
    const s1 = typeof task.s1 === "string" ? task.s1 : "great";
    const s2 = typeof task.s2 === "string" ? task.s2 : "rgeat";
    const memo = new Map<string, boolean>();
    const records: Record[] = [];

    const solve = (a: string, b: string): boolean => {
        const key = `${a}|${b}`;
        const known = memo.get(key);
        if (known !== undefined) {
            return known;
        }
        let result = false;
        if (a === b) {
            result = true;
        } else if (sameLetters(a, b)) {
            const n = a.length;
            for (let split = 1; split < n && !result; split += 1) {
                const aLeft = a.slice(0, split);
                const aRight = a.slice(split);
                if (solve(aLeft, b.slice(0, split)) && solve(aRight, b.slice(split))) {
                    result = true;
                    break;
                }
                if (solve(aLeft, b.slice(n - split)) && solve(aRight, b.slice(0, n - split))) {
                    result = true;
                    break;
                }
            }
        }
        memo.set(key, result);
        records.push({ a, b, result });
        return result;
    };

    const answer = solve(s1, s2);
    const cols = Math.max(1, s1.length, s2.length);
    const makeGrid = (pair: Record | null): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let col = 0; col < cols; col += 1) {
            const first = pair?.a[col];
            entities.push({
                id: `cell-0-${col}`,
                type: "cell" as const,
                label: first ?? "-",
                value: first ?? "",
                state: first === undefined ? "idle" : "active",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col },
            });
            const second = pair?.b[col];
            entities.push({
                id: `cell-1-${col}`,
                type: "cell" as const,
                label: second ?? "-",
                value: second ?? "",
                state:
                    second === undefined
                        ? "idle"
                        : pair?.result
                          ? "sorted"
                          : "error",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1, col },
            });
        }
        return entities;
    };

    let step = 0;
    const frame = (pair: Record | null, description: string, line: number, final: boolean): VisualFrame => {
        const result: VisualFrame = {
            stepNumber: step,
            entities: makeGrid(pair),
            edges: [],
            description,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                s1,
                s2,
                pair: pair ? `${pair.a}|${pair.b}` : "",
                result: pair?.result ?? false,
                memo: memo.size,
                answer,
                rows: 2,
                cols,
                final,
            },
        };
        step += 1;
        return result;
    };

    yield frame(null, `Testing whether "${s2}" is a scramble of "${s1}".`, 0, false);
    for (const record of records) {
        yield frame(
            record,
            `Substrings "${record.a}" and "${record.b}" ${record.result ? "can" : "cannot"} be scrambles.`,
            3,
            false,
        );
    }
    yield frame(
        { a: s1, b: s2, result: answer },
        answer
            ? `"${s2}" is a scramble of "${s1}" after ${memo.size} memoized decisions.`
            : `"${s2}" is not a scramble of "${s1}" after ${memo.size} memoized decisions.`,
        5,
        true,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A scramble is built by recursively cutting a string in two and optionally exchanging the halves. To test two strings, try every cut and compare the matching halves directly and in swapped order. If the character multisets differ the branch is hopeless, and remembering previously decided substring pairs keeps the search from repeating itself.",
        invariants: [
            "Only substrings of equal length and equal character multiset are explored.",
            "Every memoized decision is the exact answer for its substring pair.",
            "Trying both orientations at each cut covers every recursive scramble tree.",
        ],
        correctness:
            "Any scramble of a string arises from some first cut and either keeping or swapping the two recursively scrambled pieces, so trying all cuts and both orientations is exhaustive. The character-multiset check is a necessary condition, so pruning it cannot discard a valid scramble. Induction on length proves each stored decision is correct, and the root decision is therefore exact.",
        complexityRationale:
            "There are O(n^3) distinct substring pairs and trying a pair examines O(n) cuts, giving O(n^4) time in the worst case, far below the unmemoized exponential search. The memo table and the recorded decisions use O(n^3) space.",
        uses: [
            "Checking whether two sequences share a common recursive split structure",
            "A teaching example of memoization over substrings",
            "A small model for tree-edit and rearrangement distance problems",
        ],
        references: [
            "LeetCode problem 87, Scramble String",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, Chapter 15",
        ],
        workedExample:
            "To see that great and rgeat are scrambles, split great as gr plus eat and rgeat as rg plus eat. Swapping the outer pieces gives rg plus eat, and gr is a scramble of rg by one swap, so the answer is true. For abcde and caebd no split works and the answer is false.",
    },
    id: "scramble-string",
    name: "Scramble String Check",
    category: "dynamic-programming",
    complexity: { time: "O(n^4) memoized", space: "O(n^3)" },
    defaultInput: { s1: "great", s2: "rgeat" },
    visualType: "grid",
    run,
    pseudocode: [
        "if the two strings are equal, report success",
        "if their character multisets differ, report failure",
        "for every split position, compare both orientations of the halves",
        "recurse on each pair of halves and combine the results",
        "memoize the decision for this substring pair",
        "try the next split until one orientation succeeds",
        "done: report whether the whole strings are scrambles",
    ],
};

export default module;
