/**
 * patience-diff.ts – Patience Diff.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n log n) avg", space: "O(n)"
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
    const t = (input as { a?: string[]; b?: string[] } | null) ?? {};
    const a = t.a ?? ["a", "b", "c"];
    const b = t.b ?? ["a", "c", "b"];
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
    yield F(tx(a.join("")), 'Patience diff: unique lines "a" as anchors.', 0);
    step += 1;
    const cb = new Map(b.map((x, i) => [x, i] as [string, number]));
    const seq: number[] = [];
    for (const x of a)
        if (
            cb.has(x) &&
            a.filter((y) => y === x).length === 1 &&
            b.filter((y) => y === x).length === 1
        )
            seq.push(cb.get(x) as number);
    yield F(
        tx(
            a.join(""),
            stAt(
                seq.map((_, i) => i),
                "comparing",
            ),
        ),
        `Unique-common positions: [${seq.join(", ")}].`,
        1,
    );
    step += 1;
    const piles: number[] = [];
    for (const x of seq) {
        let lo = 0,
            hi = piles.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if ((piles[mid] as number) < x) lo = mid + 1;
            else hi = mid;
        }
        piles[lo] = x;
        if (step < 10) {
            yield F(tx(a.join("")), `Patience pile ${lo} ← line ${x}.`, 2);
            step += 1;
        }
    }
    const lcsLen = piles.length;
    const ops: string[] = [];
    let i = 0,
        j = 0;
    while (i < a.length || j < b.length) {
        if (i < a.length && j < b.length && a[i] === b[j]) {
            ops.push(` ${a[i]}`);
            i += 1;
            j += 1;
        } else if (j < b.length && (i >= a.length || !a.slice(i).includes(b[j] as string))) {
            ops.push(`+${b[j]}`);
            j += 1;
        } else {
            ops.push(`-${a[i]}`);
            i += 1;
        }
    }
    yield F(tx(a.join("")), `LCS length ${lcsLen}; script:${ops.join(" ")}.`, 3, { ops });
    step += 1;
    yield F(tx(b.join("")), `Diff complete: ${ops.length} ops:${ops.join(" ")}.`, 4, { ops });
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Patience diff compares two sequences by focusing on lines that are unique in both, using their matched positions as anchors. It finds the longest increasing subsequence of those anchors to identify a stable matching, then recursively diffs the regions between anchors.",
        "invariants": [
            "An anchor is a line appearing exactly once in each input, so its match is unambiguous.",
            "The increasing subsequence of anchor positions respects the order in both sequences."
        ],
        "correctness": "Because unique lines can only match one another, any chosen anchor must pair with its unique counterpart; the LIS selects the largest set of anchors whose order agrees in both files. Recursing between anchors yields a readable diff consistent with those anchors.",
        "complexityRationale": "Finding unique lines and positions costs O(n) per file with hashing and the LIS of k anchors costs O(k log k), giving O(n log n) average time and O(n) space.",
        "uses": [
            "The diff option used in version control such as Git's patience diff",
            "Producing human-readable patches",
            "Comparing source files with repeated boilerplate"
        ],
        "references": [
            "Cohen, Patience Diff, bramcohen.com",
            "Hunt and Szymanski, A Fast Algorithm for Computing Longest Common Subsequences, 1977"
        ],
        "workedExample": "For a=[\"a\",\"b\",\"c\"] and b=[\"a\",\"c\",\"b\"] all lines are unique with positions in b [0,2,1]; the longest increasing subsequence is [0,2] (lines a and c), anchoring the diff and leaving b as a move between them."
    },
    id: "patience-diff",
    name: "Patience Diff",
    category: "string",
    complexity: { time: "O(n log n) avg", space: "O(n)" },
    defaultInput: { a: ["a", "b", "c"], b: ["a", "c", "b"] },
    visualType: "text",
    run,
    pseudocode: [
        "find unique common lines as anchor points",
        "sort anchors by position in both files",
        "extract longest increasing subsequence of anchors",
        "recursively diff regions between anchors",
        "emit equal delete and insert operations",
        "concatenate scripts from all regions",
        "report unified diff operations",
    ],
};

export default module;
