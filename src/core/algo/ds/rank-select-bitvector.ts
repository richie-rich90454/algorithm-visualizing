/**
 * rank-select-bitvector.ts – Rank-Select Bitvector
 *
 * Succinct bitvector: block popcounts plus superblock totals answer
 * rank (ones below i) in O(1), and select (position of the k-th one)
 * scans blocks with the totals as a runway.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Succinct bitvector: block popcounts plus superblock totals answer rank (ones below i) in O(1), and select (position of the k-th one) scans blocks with the totals as a runway.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) rank
 *   Space: n + o(n) bits
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *    - Cells form rows or columns of values.
 *    - The touched cell is YELLOW (comparing).
 *    - Finished cells are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Standard Rank-Select Bitvector behavior with textbook operation costs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const BLOCK = 4;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bits?: number[]; rankAt?: number; selectK?: number } | null) ?? {};
    const bits = task.bits ?? [1, 0, 1, 1, 0, 0, 1, 0];
    const rankAt = task.rankAt ?? 5;
    const selectK = task.selectK ?? 3;
    let step = 0;

    const pop = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);
    const blocks: number[][] = [];
    for (let i = 0; i < bits.length; i += BLOCK) {
        blocks.push(bits.slice(i, i + BLOCK));
    }
    const blockPop = blocks.map(pop);
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: bits.map((b, i) => ({
            id: `rs-${i}`,
            type: "cell" as const,
            label: String(b),
            value: b,
            state: (hot.has(i) ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        })),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { blocks: blocks.length, blockPop: blockPop.join(",") },
    });

    yield snap(
        new Set(),
        `Bitvector [${bits.join("")}] in blocks of ${BLOCK} – popcounts [${blockPop.join(",")}].`,
        0,
    );
    step += 1;
    const fullBlocks = Math.floor(rankAt / BLOCK);
    let rank = 0;
    for (let b = 0; b < fullBlocks; b += 1) {
        rank += blockPop[b] ?? 0;
    }
    const scanned = new Set<number>();
    for (let i = fullBlocks * BLOCK; i < rankAt; i += 1) {
        rank += bits[i] ?? 0;
        scanned.add(i);
    }
    yield snap(
        scanned,
        `rank(${rankAt}) = superblock ${rank - pop(bits.slice(fullBlocks * BLOCK, rankAt))} + scan = ${rank}.`,
        1,
    );
    step += 1;
    let seen = 0;
    let pos = -1;
    for (let i = 0; i < bits.length; i += 1) {
        seen += bits[i] ?? 0;
        if (seen === selectK) {
            pos = i;
            break;
        }
    }
    yield snap(new Set([pos]), `select(${selectK}) lands at position ${pos}.`, 2);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A rank-select bitvector answers rank(i), the number of ones before position i, and select(k), the position of the k-th one, using small popcount tables. Superblock totals plus per-block counts let rank read only a couple of counters and one short scan, while select jumps to the right block using the totals.",
        "invariants": [
            "Stored block counts equal the true ones count in each block.",
            "Superblock totals are sums of their blocks.",
            "Rank and select agree on the same underlying bit sequence."
        ],
        "correctness": "Rank(i) is the superblock total before i plus complete block counts plus the popcount of the partial block, which counts exactly the ones before i. Select finds the first block whose running total reaches k and then locates the k-th one inside it; the totals guarantee that block is the right one.",
        "complexityRationale": "Rank touches one superblock counter, one block counter, and one short scan, O(1) for fixed block size. Select jumps by superblock and scans one block, also O(1); auxiliary tables add only o(n) bits beyond the n raw bits.",
        "uses": [
            "Succinct data structures and compressed indexes",
            "FM-index and wavelet tree rank support",
            "Bit-parallel algorithms needing fast counting"
        ],
        "references": [
            "Jacobson, Space-Efficient Static Trees and Graphs, FOCS 1989",
            "Clark and Munro, Efficient Succinct Encoding of Binary Search Trees, CPM 1994"
        ],
        "workedExample": "For bits [1,0,1,1,0,0,1,0], rank(5) counts three ones in positions 0 through 4; select(3) returns position 3, the third one; superblock totals guide both jumps."
    },
    id: "rank-select-bitvector",
    name: "Rank-Select Bitvector",
    category: "data-structures",
    complexity: { time: "O(1) rank", space: "n + o(n) bits" },
    defaultInput: { bits: [1, 0, 1, 1, 0, 0, 1, 0], rankAt: 5, selectK: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with the raw bitvector and no auxiliary tables",
        "cut the bits into fixed blocks and count ones per block",
        "build superblock totals over groups of blocks",
        "rank(pos): add the superblock total plus the in-block scan",
        "select(k): jump to the block holding the kth one, then scan bits",
        "both operations touch only a few counters plus one short scan",
        "done: rank count and select position are reported",
    ],
};

export default module;
