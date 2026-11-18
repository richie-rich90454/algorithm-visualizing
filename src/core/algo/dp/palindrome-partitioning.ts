/**
 * palindrome-partitioning.ts - Palindrome Partitioning (enumerate all cuts)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a string, list every way to cut it into substrings that are all
 * palindromes. A DP table first records which substrings are palindromes:
 *
 *   isPal[i][j] = s[i] == s[j] and (j - i < 2 or isPal[i+1][j-1])
 *
 * A backtracking pass then walks the string left to right, extending the
 * current prefix by every palindrome substring that starts at the current
 * position. When the walk reaches the end, the chosen pieces form one valid
 * partition.
 *
 * This differs from palindrome partitioning with minimum cuts, which returns
 * a single optimal cut count; here the goal is the full list of partitions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 + n * P) where P is the number of printed partitions
 *   Space: O(n^2) for the palindrome table plus the output
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Characters of the candidate substring are PINK (highlight).
 *   - Characters already committed to the prefix are CYAN (path).
 *   - Finished partitions are reported in the final frame's meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeChars(
    s: string,
    candidateStart = -1,
    candidateEnd = -1,
    committed = 0,
): VisualEntity[] {
    return [...s].map((char, index) => {
        let state: EntityState = "unvisited";
        if (index < committed) {
            state = "path";
        }
        if (index >= candidateStart && index <= candidateEnd) {
            state = "highlight";
        }
        return {
            id: `char-${index}`,
            type: "character" as const,
            label: char,
            value: char,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { s?: string } | null) ?? {};
    const s = typeof task.s === "string" ? task.s : "aab";
    const chars = [...s];
    const n = chars.length;
    let step = 0;

    if (n === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Empty string: the only partition is the empty list.",
            codeLineNumber: 0,
            layout: "text",
            meta: { count: 1, partitions: [""], length: 0 },
        };
        return;
    }

    const isPal: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
    for (let length = 1; length <= n; length += 1) {
        for (let i = 0; i + length - 1 < n; i += 1) {
            const j = i + length - 1;
            if (chars[i] === chars[j] && (length <= 2 || (isPal[i + 1]?.[j - 1] ?? false))) {
                isPal[i][j] = true;
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeChars(s),
        edges: [],
        description: `Palindrome table ready for "${s}"; ${n} characters to partition.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { length: n },
    };
    step += 1;

    const partitions: string[] = [];

    function* search(start: number, pieces: string[], committed: number): Generator<VisualFrame, void, unknown> {
        if (start === n) {
            partitions.push(pieces.join("|"));
            yield {
                stepNumber: step,
                entities: makeChars(s, -1, -1, committed),
                edges: [],
                description: `Partition ${partitions.length}: ${pieces.join(" | ")}.`,
                codeLineNumber: 4,
                layout: "text",
                meta: { length: n, found: partitions.length },
            };
            step += 1;
            return;
        }

        for (let end = start; end < n; end += 1) {
            if (!(isPal[start]?.[end] ?? false)) {
                continue;
            }
            const piece = chars.slice(start, end + 1).join("");
            yield {
                stepNumber: step,
                entities: makeChars(s, start, end, committed),
                edges: [],
                description: `Substring "${piece}" at [${start}, ${end}] is a palindrome; try it as the next piece.`,
                codeLineNumber: 2,
                layout: "text",
                meta: { length: n, found: partitions.length, start, end },
            };
            step += 1;
            yield* search(end + 1, [...pieces, piece], committed + piece.length);
        }
    }

    yield* search(0, [], 0);

    yield {
        stepNumber: step,
        entities: makeChars(s, -1, -1, n),
        edges: [],
        description: `Found ${partitions.length} palindrome partition(s) of "${s}".`,
        codeLineNumber: 6,
        layout: "text",
        meta: { length: n, count: partitions.length, partitions: [...partitions] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "First write down which substrings read the same backward as forward; a substring is a palindrome when its ends match and the inside is already known to be one. Then walk left to right and, at each position, try every palindrome starting there. Whenever the walk reaches the end, the pieces chosen along the way are one complete partition.",
        invariants: [
            "isPal[i][j] is true exactly when s[i..j] is a palindrome.",
            "The pieces chosen so far always cover a contiguous prefix of the string.",
            "Every prefix piece is a palindrome, so every completed list is a valid partition.",
        ],
        correctness:
            "A palindrome partition is a sequence of cut points where each resulting piece is a palindrome. The backtracking loop tries every possible next piece whose ends are a known palindrome, so by induction every valid partition is generated. Conversely, each recorded partition only uses pieces accepted by the palindrome table, so no invalid partition appears. The table itself is correct by induction on substring length.",
        complexityRationale:
            "Filling the boolean table checks O(n^2) substrings in constant time each. Backtracking spends O(n) work per emitted partition, so the total is O(n^2 + nP) where P is the number of partitions, which can be exponential in the worst case such as a string of identical characters.",
        uses: [
            "Enumerating segmentation options in text and speech processing",
            "Bioinformatics repeat segmentation of sequences",
            "A teaching example that combines DP with backtracking",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, Chapter 15",
            "LeetCode 131, Palindrome Partitioning (canonical statement)",
        ],
        workedExample:
            "For s = aab, the palindrome substrings include a, aa, and b. Starting with the single a leaves ab, which forces a then b, giving a | a | b. Starting with aa leaves b, giving aa | b. No other palindrome starts at position 0, so exactly two partitions exist.",
    },
    id: "palindrome-partitioning",
    name: "Palindrome Partitioning (All Cuts)",
    category: "dynamic-programming",
    complexity: { time: "O(n^2 + n*P)", space: "O(n^2)" },
    defaultInput: { s: "aab" },
    visualType: "text",
    run,
    pseudocode: [
        "build isPal[i][j] by increasing substring length",
        "isPal[i][j] <- s[i] = s[j] and isPal[i+1][j-1]",
        "define search(start, pieces)",
        "for each end from start to n-1 with isPal[start][end]",
        "recurse on end+1 with the palindrome piece appended",
        "when start = n record the joined pieces as a partition",
        "return the complete list of recorded partitions",
    ],
};

export default module;
