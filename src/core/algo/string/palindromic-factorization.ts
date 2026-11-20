/**
 * palindromic-factorization.ts – Palindromic Factorization.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n²)", space: "O(n)"
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";
function tx(t: string, st: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(t).map((c) => {
        const i = Number((c.metadata as Record<string, unknown>)["index"]);
        return { ...c, state: st.get(i) ?? "idle" };
    });
}
function stAt(pos: number[], s: EntityState): Map<number, EntityState> {
    return new Map(pos.map((p) => [p, s] as [number, EntityState]));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { text?: string } | null) ?? {};
    const text = t.text ?? "ababa";
    let step = 0;
    const F = (
        entities: VisualEntity[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber,
        layout: "text",
        meta: { comparisons: 0, matches: [], ...meta },
    });
    yield F(tx(text), `Minimum palindromic partition of "${text}".`, 0);
    step += 1;
    const n = text.length;
    const isPal: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
    for (let i = 0; i < n; i += 1) (isPal[i] as boolean[])[i] = true;
    for (let len = 2; len <= n; len += 1)
        for (let i = 0; i + len <= n; i += 1) {
            const j = i + len - 1;
            (isPal[i] as boolean[])[j] =
                text[i] === text[j] &&
                (len === 2 || ((isPal[i + 1] as boolean[])[j - 1] as boolean));
        }
    yield F(tx(text), `Palindromic radius table ready for text "t".`, 1);
    step += 1;
    const dp = new Array<number>(n + 1).fill(Infinity);
    const cut = new Array<number>(n + 1).fill(-1);
    dp[n] = 0;
    for (let i = n - 1; i >= 0; i -= 1)
        for (let j = i; j < n; j += 1) {
            if ((isPal[i] as boolean[])[j] && (dp[j + 1] as number) + 1 < (dp[i] as number)) {
                dp[i] = (dp[j + 1] as number) + 1;
                cut[i] = j + 1;
            }
        }
    const parts: string[] = [];
    let i = 0,
        shown = 0;
    while (i < n && shown < 3) {
        const j = cut[i] as number;
        parts.push(text.slice(i, j));
        yield F(
            tx(
                text,
                stAt(
                    Array.from({ length: j - i }, (_, x) => i + x),
                    "comparing",
                ),
            ),
            `Cut palindrome "${text.slice(i, j)}".`,
            2,
            { parts: [...parts] },
        );
        step += 1;
        i = j;
        shown += 1;
    }
    while (i < n) {
        const j = cut[i] as number;
        parts.push(text.slice(i, j));
        i = j;
    }
    yield F(
        tx(
            text,
            stAt(
                text.split("").map((_, x) => x),
                "sorted",
            ),
        ),
        `${parts.length} part(s): ${parts.join(" | ")}.`,
        3,
        { parts },
    );
    step += 1;
    yield F(tx(text), `Partition complete: ${parts.length} part(s): ${parts.join(" | ")}.`, 4, {
        parts,
    });
}

const module: AlgorithmModule = {

    education: {
        "intuition": "This finds the fewest palindromes whose concatenation equals the input. It first precomputes which substrings are palindromes, then uses DP where dp[i] is the minimum number of palindromes needed for the prefix ending at i, choosing a cut at the best palindrome ending there.",
        "invariants": [
            "isPal[i][j] is true exactly when s[i..j] is a palindrome.",
            "dp[i] is the minimum number of palindromic parts covering s[0..i-1] and cut[i] records the start of the last part."
        ],
        "correctness": "The palindrome table is correct by induction on length, since a substring is a palindrome when its ends match and the interior is. The DP considers every palindrome ending at i and takes the minimum, so by optimal substructure dp[n] is the true minimum and following cut pointers reconstructs the partition.",
        "complexityRationale": "Computing the palindrome table considers O(n^2) substrings with O(1) work each, and the DP tries all starts for each end, giving O(n^2) time and O(n^2) space for the table, with O(n) for the stored cuts.",
        "uses": [
            "Palindrome-based text compression",
            "Analyzing palindromic structure in genomes",
            "Partitioning strings for pattern matching"
        ],
        "references": [
            "Crochemore et al., Algorithms on Strings",
            "Ravsky et al., On the Palindromic Factorization of a Word"
        ],
        "workedExample": "For \"ababa\" the whole string is itself a palindrome, so the minimum partition is the single part \"ababa\"; a less efficient tie-break might give \"a | bab | a\", but the DP prefers the fewest parts."
    },
    id: "palindromic-factorization",
    name: "Palindromic Factorization",
    category: "string",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: { text: "ababa" },
    visualType: "text",
    run,
    pseudocode: [
        "precompute palindrome radius for all centers",
        "initialize minimum cuts table with infinities",
        "extend palindromes ending at each position",
        "update minimum partition count on palindrome found",
        "record cut position for optimal reconstruction",
        "trace cuts backward to recover factors",
        "report minimum partition and factors",
    ],
};

export default module;
