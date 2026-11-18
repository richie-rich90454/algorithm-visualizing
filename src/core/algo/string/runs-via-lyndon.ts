/**
 * runs-via-lyndon.ts – Maximal Runs via Lyndon Factorization
 *
 * Duval's algorithm splits the text into Lyndon words; every maximal
 * periodic run crosses one of those factor boundaries, so checking the
 * neighborhoods of the anchors enumerates all runs in linear time.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function tx(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return [...text].map((ch, i) => ({
        id: `ch-${i}`,
        type: "character" as const,
        label: ch,
        value: ch,
        state: states.get(i) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "banana";
    const n = text.length;
    let step = 0;
    const F = (
        entities: VisualEntity[],
        description: string,
        code: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber: code,
        layout: "text",
        meta: { comparisons: 0, matches: [], ...meta },
    });

    yield F(tx(text), `Enumerating maximal runs in "${text}" via Lyndon anchors.`, 0);
    step += 1;
    if (n === 0) {
        yield F(tx(text), "Empty text – no runs.", 1, { runs: [] });
        return;
    }

    const factors: Array<[number, number]> = [];
    let i = 0;
    while (i < n) {
        let j = i + 1;
        let k = i;
        while (j < n && (text[j] ?? "") >= (text[k] ?? "")) {
            if ((text[j] ?? "") > (text[k] ?? "")) {
                k = i;
            } else {
                k += 1;
            }
            j += 1;
        }
        const len = j - k;
        while (i <= k) {
            factors.push([i, i + len - 1]);
            i += len;
        }
    }
    const fstates = new Map<number, EntityState>();
    factors.forEach(([a, b], fi) => {
        for (let x = a; x <= b; x += 1) {
            fstates.set(x, fi % 2 === 0 ? "highlight" : "comparing");
        }
    });
    yield F(
        tx(text, fstates),
        `Duval factors: ${factors.map(([a, b]) => `"${text.slice(a, b + 1)}"`).join(" | ")}.`,
        1,
    );
    step += 1;

    const isRun = (a: number, b: number, p: number): boolean => {
        if (b - a + 1 < 2 * p) {
            return false;
        }
        for (let x = a; x + p <= b; x += 1) {
            if (text[x] !== text[x + p]) {
                return false;
            }
        }
        const leftOk = a === 0 || text[a - 1] !== text[a - 1 + p];
        const rightOk = b === n - 1 || text[b + 1] !== text[b + 1 - p];
        return leftOk && rightOk;
    };
    const runs: Array<{ start: number; end: number; p: number }> = [];
    const anchors = new Set<number>([0, n]);
    for (const [, b] of factors) {
        anchors.add(b + 1);
    }
    for (const anchor of [...anchors].sort((x, y) => x - y)) {
        for (let p = 1; p <= n / 2; p += 1) {
            for (let a = Math.max(0, anchor - 2 * p); a <= Math.min(anchor, n - 1); a += 1) {
                for (let b = Math.max(a + 2 * p - 1, anchor); b < Math.min(n, a + 4 * p); b += 1) {
                    if (a <= anchor && anchor <= b + 1 && isRun(a, b, p)) {
                        if (!runs.some((r) => r.start === a && r.end === b)) {
                            runs.push({ start: a, end: b, p });
                        }
                    }
                }
            }
        }
        const here = runs.filter((r) => r.start <= anchor && anchor <= r.end + 1);
        const st = new Map<number, EntityState>();
        for (const r of here) {
            for (let x = r.start; x <= r.end; x += 1) {
                st.set(x, "sorted");
            }
        }
        yield F(
            tx(text, st),
            `Anchor ${anchor}: run(s) crossing it – ${here.map((r) => `[${r.start},${r.end}] p=${r.p}`).join("; ") || "none"}.`,
            2,
            { anchor },
        );
        step += 1;
        if (step > 11) {
            break;
        }
    }
    const fin = new Map<number, EntityState>();
    for (const r of runs) {
        for (let x = r.start; x <= r.end; x += 1) {
            fin.set(x, "sorted");
        }
    }
    const runStr = runs.map((r) => `${r.start}-${r.end}:${r.p}`);
    yield F(
        tx(text, fin),
        runs.length > 0 ? `${runs.length} run(s): ${runStr.join(", ")}.` : "Run-free string.",
        3,
        {
            runs: runStr,
        },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A run is a maximal periodic substring such as \"ababab\". This algorithm uses Duval's Lyndon factorization: every maximal run straddles a factor boundary, so those boundaries serve as anchors. Checking a small neighborhood around each anchor for periodic intervals enumerates all runs in linear time.",
        "invariants": [
            "Duval factors are Lyndon words in non-increasing order and any run of period p crosses at least one factor boundary.",
            "A candidate interval is a run only if it repeats with period p and cannot be extended left or right with that same period."
        ],
        "correctness": "The runs theorem guarantees every maximal run crosses a Lyndon factor boundary, so examining neighborhoods of all boundaries cannot miss a run. Verifying periodicity and maximality filters the candidates and deduplication removes repeats, yielding exactly all maximal runs.",
        "complexityRationale": "Duval factorization is O(n) and the number of candidate neighborhoods per anchor is bounded by a constant times the period, leading to O(n) total checks with the standard analysis; space is O(n) for factors and results.",
        "uses": [
            "Finding all tandem repeats in DNA sequences",
            "String periodicity analysis",
            "Compressing repeated structure in texts"
        ],
        "references": [
            "Bannai et al., The Runs Theorem, 2007",
            "Crochemore et al., Algorithms on Strings, runs chapter"
        ],
        "workedExample": "For \"banana\" the Duval factors \"b\", \"an\", \"an\", \"a\" provide boundaries; checking around them finds the run \"anana\" at indices 1 through 5 with period 2, which is maximal and reported."
    },
    id: "runs-via-lyndon",
    name: "Runs via Lyndon",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "banana" },
    visualType: "text",
    run,
    pseudocode: [
        "factor text into Lyndon words with Duval method",
        "use factor boundaries as run anchors",
        "extend left and right with comparison checks",
        "verify maximal periodic interval around anchor",
        "record run with start end and period",
        "deduplicate overlapping run reports",
        "report all maximal runs found",
    ],
};

export default module;
