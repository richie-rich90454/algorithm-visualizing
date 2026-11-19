/**
 * landau-vishkin-alignment.ts - Diagonal edit distance by longest extension.
 *
 * Landau-Vishkin computes edit distance by following diagonals i - j. For a
 * given edit count k it keeps the furthest position reached on each diagonal
 * and extends it for free over matching characters. The first k that reaches
 * the end of both strings is the edit distance. This is the classic
 * furthest-reaching diagonal formulation of the k-difference algorithm.
 *
 *   Time:  O((n + m)^2) in this straightforward character-comparison form
 *   Space: O(n + m)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeRows(a: string, b: string, active: number[] = []): VisualEntity[] {
    const out: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        const text = row === 0 ? a : b;
        for (let col = 0; col < text.length; col += 1) {
            const char = text[col] ?? "";
            out.push({
                id: `char-${row}-${col}`,
                type: "cell" as const,
                label: char,
                value: char,
                state: (active.includes(col) ? "comparing" : row === 0 ? "idle" : "unvisited") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, char },
            });
        }
    }
    return out;
}

/** Furthest-reaching diagonal computation of unit-cost edit distance. */
function landauVishkin(a: string, b: string): { distance: number; rounds: Array<{ k: number; reach: Array<[number, number]> }> } {
    const n = a.length;
    const m = b.length;
    const rounds: Array<{ k: number; reach: Array<[number, number]> }> = [];
    if (n === 0 && m === 0) return { distance: 0, rounds };
    let prev = new Map<number, number>();
    for (let k = 0; k <= n + m; k += 1) {
        const cur = new Map<number, number>();
        for (let d = -k; d <= k; d += 1) {
            const fromDeletion = (prev.get(d - 1) ?? -1) + 1;
            const fromInsertion = prev.get(d + 1) ?? -1;
            const fromSubstitution = (prev.get(d) ?? -1) + 1;
            let x = k === 0 ? 0 : Math.max(fromDeletion, fromInsertion, fromSubstitution);
            if (x < 0) continue;
            let y = x - d;
            if (y < 0) {
                x = -y;
                y = 0;
            }
            while (x < n && y < m && y >= 0 && a[x] === b[y]) {
                x += 1;
                y += 1;
            }
            cur.set(d, x);
        }
        const reach = [...cur.entries()].map(([d, x]) => [d, x] as [number, number]);
        rounds.push({ k, reach });
        for (const [d, x] of cur) {
            if (x >= n && x - d >= m) return { distance: k, rounds };
        }
        prev = cur;
    }
    return { distance: n + m, rounds };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string; b?: string } | null) ?? {};
    const a = task.a ?? "GATTACA";
    const b = task.b ?? "GATTCGA";
    let step = 0;
    const frame = (
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
        layout: "grid",
        meta: { rows: 2, cols: Math.max(a.length, b.length), ...meta },
    });

    const { distance, rounds } = landauVishkin(a, b);
    yield frame(makeRows(a, b), `Finding the edit distance between "${a}" and "${b}" by diagonals.`, 0);
    step += 1;
    const shown = rounds.slice(0, 6);
    for (const round of shown) {
        const active = round.reach.length > 0
            ? [Math.min(a.length - 1, Math.max(0, round.reach[round.reach.length - 1]![0] + round.reach.length))]
            : [];
        yield frame(
            makeRows(a, b, active),
            `Edit count k=${round.k}: furthest reaches on ${round.reach.length} diagonal(s).`,
            round.k === 0 ? 1 : 2,
            {
                k: round.k,
                reach: round.reach.map(([d, x]) => `${d}:${x}`),
                diagonals: round.reach.map(([d]) => d),
            },
        );
        step += 1;
    }
    if (rounds.length > shown.length) {
        yield frame(
            makeRows(a, b),
            `Skipped ${rounds.length - shown.length} intermediate edit counts for clarity.`,
            3,
            { skipped: rounds.length - shown.length },
        );
        step += 1;
    }
    yield frame(
        makeRows(a, b),
        `Edit distance is ${distance}.`,
        4,
        { distance, rounds: rounds.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Landau-Vishkin views an alignment as a walk on diagonals of the comparison grid, where a diagonal is the difference between the current index in the first string and the index in the second. Wherever the two characters match, the walk can continue for free. The algorithm spends one edit to step onto a neighboring diagonal or to skip a mismatch, and the first edit budget that reaches the far corner is the edit distance.",
        invariants: [
            "At edit count k, each stored value is the furthest index reached on its diagonal.",
            "Extending over matching characters costs no edits, so it never increases k.",
            "Moving to a neighboring diagonal or skipping one character always increases the edit count by exactly one.",
        ],
        correctness:
            "A furthest-reaching position dominates every earlier position on the same diagonal, because starting farther along can only leave more characters available for free matches. The update considers all three ways to arrive at a diagonal with one more edit, deletion, insertion, and substitution, then greedily extends over matches. By induction on k the stored values are the farthest reachable positions for that edit budget, so the smallest k whose reach covers both strings is exactly the edit distance.",
        complexityRationale:
            "For each of at most n + m edit counts the loop scans at most 2k + 1 diagonals and each extension moves forward monotonically. The direct character-comparison version therefore takes O((n + m)^2) time and stores one furthest value per diagonal, O(n + m) space.",
        uses: [
            "Approximate string matching under a fixed error bound",
            "Spelling correction and fuzzy search",
            "Comparing biological sequences when a bound on differences is known",
        ],
        references: [
            "Landau and Vishkin, Fast String Matching with k Differences, Journal of Computer and System Sciences 37 (1988)",
            "Gusfield, Algorithms on Strings, Trees, and Sequences, Chapter 12",
        ],
        workedExample:
            'For "cat" and "bat", edit count zero reaches only the first position because c differs from b. With one edit the walk substitutes c for b and then matches a and t for free, reaching the end of both strings, so the edit distance is 1.',
    },
    id: "landau-vishkin-alignment",
    name: "Landau-Vishkin Alignment",
    category: "string",
    complexity: { time: "O((n+m)^2)", space: "O(n+m)" },
    defaultInput: { a: "GATTACA", b: "GATTCGA" },
    visualType: "grid",
    run,
    pseudocode: [
        "store a furthest reach of minus one on every diagonal",
        "for each edit count k from zero upward",
        "visit diagonals from minus k to k in steps of two",
        "take the best prior reach from a neighboring diagonal or a skip",
        "extend forward while the two characters match",
        "stop when a reach covers the end of both strings",
        "report k as the edit distance",
    ],
};

export default module;
