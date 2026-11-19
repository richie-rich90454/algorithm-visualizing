/**
 * hunt-szymanski-lcs.ts - Hunt-Szymanski Longest Common Subsequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Hunt-Szymanski algorithm computes a longest common subsequence by
 * working on the sparse set of matching character pairs instead of a full DP
 * matrix. For each position in the first string it visits the matching
 * positions in the second string in decreasing order and maintains a threshold
 * array: threshold[k] is the smallest position in the second string where a
 * common subsequence of length k can end. Binary-search-style placement of
 * each match yields the LCS length, and predecessor links reconstruct it.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((r + n) log n) for r matching pairs and second-string length n
 *   Space: O(r + n) for the match lists and predecessor links
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid marks every matching character pair.
 *   - Matched pairs already scanned are PINK; the final LCS path is GREEN.
 *   - meta carries the threshold array, LCS length, and LCS string.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Node {
    i: number;
    j: number;
    prev: Node | null;
}

function makeCells(
    m: number,
    n: number,
    matches: Set<string>,
    path: Set<string>,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < m; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const key = `${i},${j}`;
            let state: EntityState = "unvisited";
            if (path.has(key)) {
                state = "sorted";
            } else if (matches.has(key)) {
                state = "highlight";
            }
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: matches.has(key) ? "*" : "",
                value: matches.has(key) ? 1 : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string; b?: string } | null) ?? {};
    const a = typeof task.a === "string" ? task.a : "ABCBDAB";
    const b = typeof task.b === "string" ? task.b : "BDCABA";
    const m = a.length;
    const n = b.length;

    const matchList = new Map<string, number[]>();
    const matches = new Set<string>();
    for (let j = 0; j < n; j += 1) {
        const ch = b[j] as string;
        const list = matchList.get(ch) ?? [];
        list.push(j);
        matchList.set(ch, list);
    }
    for (let i = 0; i < m; i += 1) {
        for (const j of matchList.get(a[i] as string) ?? []) {
            matches.add(`${i},${j}`);
        }
    }

    const threshold: number[] = [-1];
    const nodes: Array<Node | null> = [null];
    let L = 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(m, n, matches, new Set()),
        edges: [],
        description: `Hunt-Szymanski LCS of "${a}" and "${b}": ${matches.size} matching pair(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: m, cols: n, lcsLength: 0, threshold: [...threshold], matches: matches.size },
    };
    step += 1;

    for (let i = 0; i < m; i += 1) {
        const before = nodes.slice();
        const positions = matchList.get(a[i] as string) ?? [];
        for (let p = positions.length - 1; p >= 0; p -= 1) {
            const j = positions[p] as number;
            let k = 0;
            for (let t = L; t >= 0; t -= 1) {
                if ((threshold[t] as number) < j) {
                    k = t;
                    break;
                }
            }
            const newLen = k + 1;
            if (newLen > L || j < (threshold[newLen] as number)) {
                nodes[newLen] = { i, j, prev: before[k] ?? null };
                if (newLen > L) {
                    threshold[newLen] = j;
                    L = newLen;
                } else {
                    threshold[newLen] = j;
                }
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(m, n, matches, new Set()),
            edges: [],
            description: `After scanning a[${i}] = ${a[i]}, LCS threshold length is ${L}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: m, cols: n, lcsLength: L, threshold: [...threshold], matches: matches.size },
        };
        step += 1;
    }

    const path = new Set<string>();
    const chars: string[] = [];
    let cursor = nodes[L] ?? null;
    while (cursor) {
        path.add(`${cursor.i},${cursor.j}`);
        chars.push(a[cursor.i] as string);
        cursor = cursor.prev;
    }
    chars.reverse();
    const lcs = chars.join("");

    yield {
        stepNumber: step,
        entities: makeCells(m, n, matches, path),
        edges: [],
        description: `LCS length ${L}; one longest common subsequence is "${lcs}".`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: m, cols: n, lcsLength: L, lcs, threshold: [...threshold], matches: matches.size },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A full LCS table wastes work on cells where the two characters differ. Hunt-Szymanski only looks at matching pairs. Sweep the first string left to right; for each match in the second string, extend the longest short common subsequence that ends before that position. A small threshold array remembers the best ending position for every subsequence length, and saved links rebuild the actual subsequence.",
        invariants: [
            "threshold[k] is the smallest second-string position ending any common subsequence of length k.",
            "The threshold array is strictly increasing, so the largest usable k is found by a backward scan.",
            "Processing matches for one character in decreasing second-string position prevents reusing that character twice.",
        ],
        correctness:
            "When scanning a match (i, j), any common subsequence ending before j can be extended by this matched character. Choosing the largest k with threshold[k] less than j picks the longest such subsequence, so the new candidate of length k+1 is optimal. Updating threshold[k+1] to the smaller j keeps the invariant. By induction the final L is the LCS length, and the predecessor links trace one subsequence achieving it.",
        complexityRationale:
            "There are r matching pairs, and each triggers a search over the LCS length at most n, giving O((r + n) log n) with binary search on the increasing thresholds. Storing the match lists and predecessor links uses O(r + n) space.",
        uses: [
            "Diff tools on large files where matching lines are sparse",
            "Biological sequence comparison with long alphabets",
            "Version-control merge base computation",
        ],
        references: [
            "Hunt and Szymanski, A Fast Algorithm for Computing Longest Common Subsequences, 1977",
            "Gusfield, Algorithms on Strings, Trees, and Sequences, Chapter 11",
        ],
        workedExample:
            "For a = ABCBDAB and b = BDCABA, matches for the letter B sit at positions 0, 2, and 4 of b. Visiting them from right to left extends the best shorter subsequence without reusing the same B, and the threshold array grows to the LCS length. Backtracking the saved links yields one longest subsequence such as BCBA.",
    },
    id: "hunt-szymanski-lcs",
    name: "Hunt-Szymanski LCS",
    category: "dynamic-programming",
    complexity: { time: "O((r + n) log n)", space: "O(r + n)" },
    defaultInput: { a: "ABCBDAB", b: "BDCABA" },
    visualType: "grid",
    run,
    pseudocode: [
        "list the positions of each character in the second string",
        "initialize threshold with a sentinel of minus one and length zero",
        "for each position i in the first string",
        "visit its matching positions in the second string in decreasing order",
        "find the largest k whose threshold is less than the match position",
        "extend that subsequence, updating threshold and predecessor links",
        "backtrack the final link chain to recover one LCS",
        "done: report the LCS length and string",
    ],
};

export default module;
