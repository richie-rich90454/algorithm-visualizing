/**
 * count-sketch.ts – Count Sketch
 *
 * Unbiased frequency sketch: each row hashes an item to a counter and a
 * random sign, so overestimates cancel out and the median row estimate
 * is right in expectation – unlike Count-Min's one-sided error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ROWS = 3;
const WIDTH = 5;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { stream?: string[]; query?: string } | null) ?? {};
    const stream = task.stream ?? ["a", "b", "a", "c", "a"];
    const query = task.query ?? "a";
    let step = 0;

    const hash = (s: string, seed: number): number => {
        let h = seed;
        for (const ch of s) {
            h = (h * 31 + ch.charCodeAt(0)) % 101;
        }
        return h;
    };
    const table: number[][] = Array.from({ length: ROWS }, () => new Array<number>(WIDTH).fill(0));
    const snap = (hot: Set<string>, message: string, line: number, est: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        table.forEach((row, r) => {
            row.forEach((c, col) => {
                entities.push({
                    id: `cs-${r}-${col}`,
                    type: "cell" as const,
                    label: String(c),
                    value: c,
                    state: (hot.has(`${r}:${col}`) ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col },
                });
            });
        });
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { rows: ROWS, width: WIDTH, estimate: est },
        };
    };

    const cellsOf = (item: string): Array<[number, number, number]> => {
        const out: Array<[number, number, number]> = [];
        for (let r = 0; r < ROWS; r += 1) {
            const col = hash(item, r + 1) % WIDTH;
            const sign = hash(item, 100 + r) % 2 === 0 ? 1 : -1;
            out.push([r, col, sign]);
        }
        return out;
    };

    yield snap(
        new Set(),
        `Empty ${ROWS}x${WIDTH} count sketch over ${stream.length} updates.`,
        0,
        0,
    );
    step += 1;
    for (const item of stream) {
        const cells = cellsOf(item);
        for (const [r, col, sign] of cells) {
            const row = table[r];
            if (row !== undefined) {
                row[col] = (row[col] ?? 0) + sign;
            }
        }
        yield snap(
            new Set(cells.map(([r, c]) => `${r}:${c}`)),
            `Update "${item}" – signed counters shift.`,
            1,
            0,
        );
        step += 1;
    }
    const perRow = cellsOf(query).map(([r, col, sign]) => (table[r]?.[col] ?? 0) * sign);
    const sorted = [...perRow].sort((a, b) => a - b);
    const estimate = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const truth = stream.filter((s) => s === query).length;
    yield snap(
        new Set(cellsOf(query).map(([r, c]) => `${r}:${c}`)),
        `Query "${query}": row reads [${perRow.join(",")}], median ${estimate} (true ${truth}).`,
        2,
        estimate,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A count sketch is a probabilistic frequency summary built from several rows of counters. Each item hashes to one counter per row and receives a random plus or minus sign. Collisions add noise, but because signs are symmetric the noise has mean zero, and taking the median of the row estimates gives an unbiased answer.",
        "invariants": [
            "Each update touches exactly one counter per row.",
            "Signs are chosen independently per item and row.",
            "The estimate is the median of signed counter values."
        ],
        "correctness": "A queried item contributes its true frequency plus a sum of colliding items' signed contributions. Because those signs are random, the expected contribution of collisions is zero, so each row is an unbiased estimator. The median of several independent rows concentrates around the true frequency, keeping error small.",
        "complexityRationale": "Update and query touch one counter in each of r rows, O(r) time. The table has r rows of w counters, O(r w) space, independent of the stream length.",
        "uses": [
            "Heavy-hitter detection in network traffic",
            "Frequency estimation in streaming databases",
            "Approximate query answering at scale"
        ],
        "references": [
            "Moses Charikar, Kevin Chen, and Martin Farach-Colton, \"Finding Frequent Items in Data Streams\", ICALP 2002",
            "Graham Cormode, \"Sketch Techniques for Approximate Algorithms\", Foundations and Trends 2009"
        ],
        "workedExample": "Stream a, b, a, c, a with two rows and signs: a hits counters with + in row 1 and - in row 2. After all updates the signed row estimates for a are each 3 plus or minus collision noise; the median is near 3, the true count. A never-seen key produces estimates around zero."
    },
    id: "count-sketch",
    name: "Count Sketch",
    category: "data-structures",
    complexity: { time: "O(rows)", space: "O(rows x width)" },
    defaultInput: { stream: ["a", "b", "a", "c", "a"], query: "a" },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize Count-Sketch table of counters with hash functions",
        "hash item to one counter per row with random sign",
        "update by adding signed count to each hashed counter",
        "compare signs to keep estimate unbiased",
        "estimate query by median of signed counters",
        "count total updates processed",
        "done: sketch summarizes stream with frequency estimate",
    ],
};

export default module;
