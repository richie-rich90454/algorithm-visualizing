/**
 * compressed-suffix-array.ts - Compressed Suffix Array (BWT Index)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A compressed suffix array indexes a text by storing its Burrows-Wheeler
 * transform plus rank counts and a sparse sampling of the true suffix array.
 * The LF-mapping jumps from one suffix-array row to the row whose suffix is
 * one character shorter, which supports exact pattern counting by backward
 * search and suffix positioning by walking back to the nearest sampled row.
 * The full suffix array is never stored.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) per pattern of length m; O(K) per located row
 *   Space: O(n) bits in theory; O(n) plain values in this teaching version
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row 0 shows each BWT character, row 1 its rank, row 2 a sampled SA value.
 *   - Cells in the active backward-search range are highlighted.
 */
import type { AlgorithmModule, EntityState, MetaValue, VisualEntity, VisualFrame } from "@/types";

interface Index {
    text: string;
    t: string;
    n: number;
    sa: number[];
    bwt: string[];
    c: Record<string, number>;
    rankPrefix: Map<string, number[]>;
    sampled: number[];
    samplePeriod: number;
}

function suffixArray(text: string): number[] {
    const indices = Array.from({ length: text.length }, (_, i) => i);
    indices.sort((a, b) => (text.slice(a) < text.slice(b) ? -1 : text.slice(a) > text.slice(b) ? 1 : 0));
    return indices;
}

function buildIndex(text: string, samplePeriod: number): Index {
    const t = `${text}$`;
    const n = t.length;
    const sa = suffixArray(t);
    const bwt = sa.map((i) => t[(i - 1 + n) % n] as string);
    const chars = [...new Set([...t].sort())];
    const counts = new Map<string, number>(chars.map((ch) => [ch, 0]));
    for (const ch of t) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    const c: Record<string, number> = {};
    let running = 0;
    for (const ch of chars) {
        c[ch] = running;
        running += counts.get(ch) ?? 0;
    }
    const rankPrefix = new Map<string, number[]>();
    for (const ch of chars) {
        const arr = new Array<number>(n + 1).fill(0);
        for (let i = 0; i < n; i += 1) arr[i + 1] = (arr[i] as number) + (bwt[i] === ch ? 1 : 0);
        rankPrefix.set(ch, arr);
    }
    const sampled = sa.map((value, row) => (row % samplePeriod === 0 ? value : -1));
    return { text, t, n, sa, bwt, c, rankPrefix, sampled, samplePeriod };
}

function rankOf(index: Index, ch: string, pos: number): number {
    const arr = index.rankPrefix.get(ch);
    return arr ? (arr[pos] ?? 0) : 0;
}

function lf(index: Index, row: number): number {
    const ch = index.bwt[row] as string;
    return (index.c[ch] ?? 0) + rankOf(index, ch, row);
}

function locate(index: Index, row: number): number {
    let current = row;
    let steps = 0;
    let guard = 0;
    while ((index.sampled[current] ?? -1) < 0 && guard <= index.n) {
        current = lf(index, current);
        steps += 1;
        guard += 1;
    }
    return ((index.sampled[current] as number) + steps) % index.n;
}

function backwardSearch(index: Index, pattern: string): { sp: number; ep: number } {
    let sp = 0;
    let ep = index.n - 1;
    for (let k = pattern.length - 1; k >= 0; k -= 1) {
        const ch = pattern[k] as string;
        if (index.c[ch] === undefined) return { sp: 1, ep: 0 };
        sp = (index.c[ch] as number) + rankOf(index, ch, sp);
        ep = (index.c[ch] as number) + rankOf(index, ch, ep + 1) - 1;
        if (sp > ep) return { sp: 1, ep: 0 };
    }
    return { sp, ep };
}

function table(index: Index, active: Set<number> = new Set()): VisualEntity[] {
    const cells: VisualEntity[] = [];
    const rows = ["bwt", "rank", "sample"];
    for (let row = 0; row < rows.length; row += 1) {
        for (let col = 0; col < index.n; col += 1) {
            let label: string;
            let value: number | string;
            if (row === 0) {
                label = index.bwt[col] === "$" ? "$" : (index.bwt[col] as string);
                value = label;
            } else if (row === 1) {
                const ch = index.bwt[col] as string;
                const r = rankOf(index, ch, col) + 1;
                label = String(r);
                value = r;
            } else {
                const sample = index.sampled[col] ?? -1;
                label = sample < 0 ? "-" : String(sample);
                value = sample;
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label,
                value,
                state: (active.has(col) ? "comparing" : row === 2 && (index.sampled[col] ?? -1) >= 0 ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, kind: rows[row] as string },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; patterns?: string[]; samplePeriod?: number } | null) ?? {};
    const raw = typeof task.text === "string" ? task.text : "banana";
    const text = raw.length > 0 ? raw.slice(0, 16) : "a";
    const samplePeriod = Math.max(1, Math.floor(typeof task.samplePeriod === "number" ? task.samplePeriod : 3));
    const patterns = Array.isArray(task.patterns)
        ? task.patterns.filter((p): p is string => typeof p === "string" && p.length > 0)
        : ["ana", "nan"];
    const index = buildIndex(text, samplePeriod);
    let step = 0;

    const snap = (
        description: string,
        codeLineNumber: number,
        active: Set<number>,
        meta: Record<string, MetaValue>,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: table(index, active),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: { ...meta, rows: 3, cols: index.n, text },
    });

    yield snap(
        `Built a compressed suffix array for "${text}" with ${index.n} rows and sample period ${samplePeriod}.`,
        0,
        new Set(),
        { size: index.n },
    );

    const samples = index.sampled
        .map((value, row) => (value >= 0 ? row : -1))
        .filter((row) => row >= 0);
    for (const row of samples) {
        yield snap(
            `Sampled row ${row}: its true suffix starts at position ${index.sampled[row]}.`,
            2,
            new Set([row]),
            { row, position: index.sampled[row] as number },
        );
    }

    const located: number[] = [];
    for (let row = 0; row < index.n; row += 1) located.push(locate(index, row));
    yield snap(
        "LF-mapping walks each unsampled row back to a sampled row to recover its position.",
        4,
        new Set(samples),
        { located },
    );

    const results: Record<string, number[]> = {};
    for (const pattern of patterns) {
        const { sp, ep } = backwardSearch(index, pattern);
        const count = sp > ep ? 0 : ep - sp + 1;
        const positions: number[] = [];
        if (count > 0) {
            for (let row = sp; row <= ep; row += 1) positions.push(locate(index, row));
            positions.sort((a, b) => a - b);
        }
        results[pattern] = positions;
        const active = new Set<number>();
        if (sp <= ep) for (let row = sp; row <= ep; row += 1) active.add(row);
        yield snap(
            `Backward search for "${pattern}" matched ${count} occurrence(s) in rows ${sp}..${ep}.`,
            6,
            active,
            { pattern, count },
        );
    }

    yield snap(
        `Done: index holds the text implicitly in ${index.n} BWT cells with ${samples.length} sampled rows.`,
        7,
        new Set(),
        { results, located, samples: samples.length, size: index.n },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A compressed suffix array keeps the suffix order without writing down every suffix pointer. The BWT plus letter ranks gives the LF-mapping, which moves from a row for suffix s to the row for the suffix one character shorter. If only every K-th row stores its absolute position, any other row can walk back with LF until it reaches a sample and then add the number of steps taken.",
        invariants: [
            "LF(i) gives the row whose suffix is one character before the suffix at row i.",
            "Sampled rows store their exact suffix-array position.",
            "Backward search narrows a suffix range by prepending one pattern character at a time.",
        ],
        correctness:
            "LF-mapping is correct because moving a suffix one step left maps its row to C[ch] plus the rank of that same character at the row, which is exactly the lexicographic position of the shortened suffix. Backward search applies this mapping for each reversed pattern character, so the surviving interval is precisely the suffixes prefixed by the full pattern. Locating walks LF until a sampled row, and each LF step subtracts one from the absolute suffix position, so adding the step count to the sample recovers the original position.",
        complexityRationale:
            "Backward search performs constant work per pattern character, O(m) for a pattern of length m. Locating walks at most K steps to a sample, O(K), or O(log n) with a denser hierarchy. The BWT and rank tables are O(n) in this teaching version and O(n) bits in a succinct implementation.",
        uses: [
            "Full-text indexes for genome and large document collections",
            "Exact pattern matching with a small memory footprint",
            "The index layer behind FM-index search tools",
        ],
        references: [
            "Ferragina and Manzini, Opportunistic Data Structures with Applications, 2000",
            "Navarro and Makinen, Compressed Full-Text Indexes, ACM Computing Surveys, 2007",
        ],
        workedExample:
            "For banana the sentinel-terminated text is banana$. A sampled row stores, say, position 3. An unsampled row two LF steps away has true suffix position (3 + 2) mod 7 = 5. Backward search for ana narrows the range to the two suffixes beginning with ana, and locating them returns positions 1 and 3, matching a naive scan.",
    },
    id: "compressed-suffix-array",
    name: "Compressed Suffix Array",
    category: "string",
    complexity: { time: "O(m) count, O(K) locate", space: "O(n)" },
    defaultInput: { text: "banana", patterns: ["ana", "nan"], samplePeriod: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "append a unique sentinel and build the suffix array",
        "write the BWT character for each sorted suffix row",
        "tabulate rank of each character up to every row",
        "sample the absolute position of every K-th row",
        "LF maps a row using its character count and rank",
        "backward search prepends pattern characters to narrow a range",
        "locate walks LF to a sample and adds the step count",
        "done: report occurrence positions and index size",
    ],
};

export default module;
