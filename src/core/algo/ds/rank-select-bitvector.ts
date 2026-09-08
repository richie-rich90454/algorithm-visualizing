/**
 * rank-select-bitvector.ts – Rank-Select Bitvector
 *
 * Succinct bitvector: block popcounts plus superblock totals answer
 * rank (ones below i) in O(1), and select (position of the k-th one)
 * scans blocks with the totals as a runway.
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
    id: "rank-select-bitvector",
    name: "Rank-Select Bitvector",
    category: "data-structures",
    complexity: { time: "O(1) rank", space: "n + o(n) bits" },
    defaultInput: { bits: [1, 0, 1, 1, 0, 0, 1, 0], rankAt: 5, selectK: 3 },
    visualType: "grid",
    run,
};

export default module;
