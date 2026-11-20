/**
 * fsck-checking.ts - Filesystem Consistency Checking
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A filesystem consistency checker walks every inode's block list and counts
 * how many times each data block is referenced. A block referenced twice is a
 * cross-link, a block that is neither referenced nor free is an orphan, a
 * block outside the valid range is a missing block, and a free block that is
 * still referenced is a double-free error. Orphans can be repaired by adding
 * them back to the free list; cross-links need human guidance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(B + R + F) for B blocks, R block references and F free entries
 *   Space: O(B) for the per-block reference counts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per block, labeled with its reference count.
 *   - Healthy blocks are GREEN, the scanned block is CYAN, problems are RED.
 *   - The final frame marks orphans that were returned to the free list.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Inode {
    id: number;
    blocks: number[];
    links: number;
}

interface FsckResult {
    refcounts: number[];
    multiply: number[];
    orphan: number[];
    missing: number[];
    doubleFree: number[];
    freeAfterRepair: number[];
}

/** Independent core: count references and classify every block. */
function check(totalBlocks: number, inodes: Inode[], free: number[]): FsckResult {
    const refcounts = Array.from({ length: totalBlocks }, () => 0);
    const missing: number[] = [];
    for (const inode of inodes) {
        for (const block of inode.blocks) {
            if (block >= 0 && block < totalBlocks) {
                const next = (refcounts[block] ?? 0) + 1;
                refcounts[block] = next;
            } else {
                missing.push(block);
            }
        }
    }
    const freeSet = new Set(free.filter((b) => b >= 0 && b < totalBlocks));
    const multiply: number[] = [];
    const orphan: number[] = [];
    const doubleFree: number[] = [];
    for (let b = 0; b < totalBlocks; b += 1) {
        const count = refcounts[b] ?? 0;
        if (count > 1) multiply.push(b);
        if (count === 0 && !freeSet.has(b)) orphan.push(b);
        if (count > 0 && freeSet.has(b)) doubleFree.push(b);
    }
    return {
        refcounts,
        multiply,
        orphan,
        missing,
        doubleFree,
        freeAfterRepair: [...new Set([...free.filter((b) => b >= 0 && b < totalBlocks), ...orphan])].sort(
            (a, b) => a - b,
        ),
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { totalBlocks?: number; inodes?: Inode[]; free?: number[] } | null) ?? {};
    const totalBlocks = Math.max(1, Math.floor(task.totalBlocks ?? 8));
    const inodes: Inode[] = Array.isArray(task.inodes)
        ? task.inodes.map((inode) => ({
              id: Math.floor(inode.id ?? 0),
              blocks: Array.isArray(inode.blocks) ? [...inode.blocks] : [],
              links: Math.floor(inode.links ?? 0),
          }))
        : [
              { id: 1, blocks: [0, 1, 2], links: 1 },
              { id: 2, blocks: [3, 4], links: 1 },
              { id: 3, blocks: [2, 9], links: 2 },
          ];
    const free = Array.isArray(task.free) ? [...task.free] : [5, 6];

    const result = check(totalBlocks, inodes, free);
    const missingCells = result.missing.map((b, i) => ({ block: b, row: totalBlocks + i }));
    const rows = totalBlocks + missingCells.length;

    const cells = (
        activeBlock: number,
        phase: "scan" | "multiply" | "orphan" | "missing" | "final",
    ): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let b = 0; b < totalBlocks; b += 1) {
            const count = result.refcounts[b] ?? 0;
            const isFree = result.freeAfterRepair.includes(b) && !result.orphan.includes(b);
            let state: EntityState = isFree ? "idle" : count === 1 ? "sorted" : "unvisited";
            if (count > 1) state = "error";
            if (result.orphan.includes(b)) state = phase === "orphan" || phase === "final" ? "active" : "comparing";
            if (result.doubleFree.includes(b)) state = "error";
            if (b === activeBlock && phase === "scan") state = "comparing";
            if (phase === "multiply" && result.multiply.includes(b)) state = "highlight";
            entities.push({
                id: `cell-${b}`,
                type: "cell" as const,
                label: String(count),
                value: count,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: b, col: 0, block: b, free: isFree },
            });
        }
        for (const missing of missingCells) {
            entities.push({
                id: `cell-missing-${missing.block}`,
                type: "cell" as const,
                label: "!",
                value: missing.block,
                state: phase === "missing" || phase === "final" ? "error" : "comparing",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: missing.row, col: 0, block: missing.block, missing: true },
            });
        }
        return entities;
    };

    const commonMeta = {
        rows,
        cols: 1,
        totalBlocks,
        inodeCount: inodes.length,
        refcounts: result.refcounts,
    };

    yield {
        stepNumber: 0,
        entities: cells(-1, "scan"),
        edges: [],
        description: `Checking ${totalBlocks} blocks across ${inodes.length} inode(s); reference counts start at zero.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...commonMeta, phase: "init" },
    };
    let step = 1;
    for (let i = 0; i < inodes.length; i += 1) {
        const inode = inodes[i];
        if (!inode) continue;
        for (let k = 0; k < inode.blocks.length; k += 1) {
            const block = inode.blocks[k] ?? -1;
            yield {
                stepNumber: step,
                entities: cells(block, "scan"),
                edges: [],
                description: `Inode ${inode.id} references block ${block}; incrementing its reference count.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { ...commonMeta, phase: "scan", inode: inode.id, block },
            };
            step += 1;
        }
    }
    yield {
        stepNumber: step,
        entities: cells(result.multiply[0] ?? -1, "multiply"),
        edges: [],
        description: `Found ${result.multiply.length} cross-linked block(s): [${result.multiply.join(",")}].`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...commonMeta, phase: "multiply", multiply: result.multiply },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: cells(result.orphan[0] ?? -1, "orphan"),
        edges: [],
        description: `Found ${result.orphan.length} orphan block(s): [${result.orphan.join(",")}]; returning them to the free list.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...commonMeta, phase: "orphan", orphan: result.orphan, freeAfterRepair: result.freeAfterRepair },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: cells(-1, "missing"),
        edges: [],
        description: `Found ${result.missing.length} out-of-range block reference(s): [${result.missing.join(",")}].`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...commonMeta, phase: "missing", missing: result.missing },
    };
    step += 1;
    const problemCount = result.multiply.length + result.orphan.length + result.missing.length + result.doubleFree.length;
    yield {
        stepNumber: step,
        entities: cells(-1, "final"),
        edges: [],
        description: `Consistency check complete: ${problemCount} problem(s); repaired free list [${result.freeAfterRepair.join(",")}].`,
        codeLineNumber: 8,
        layout: "grid",
        meta: {
            ...commonMeta,
            phase: "final",
            multiply: result.multiply,
            orphan: result.orphan,
            missing: result.missing,
            doubleFree: result.doubleFree,
            freeAfterRepair: result.freeAfterRepair,
            problemCount,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A filesystem can only trust a block when exactly one valid inode claims it. The checker makes one pass over every inode's block list, tallies the claims, and then compares those tallies with the free list. Two claims mean a cross-link, zero claims outside the free list mean an orphan, and a claim on a free or out-of-range block is another error.",
        invariants: [
            "Every in-range block reference increments exactly one counter.",
            "A block is healthy precisely when its counter is one and it is not free.",
            "Repair only changes the free list; it never invents a block reference.",
        ],
        correctness:
            "The tally after scanning equals the number of inode references to each block, because each reference is visited once. Classifying a block from its tally and free-list membership is therefore exact: count greater than one is a cross-link, count zero with no free entry is an orphan, and a positive count with a free entry is a double-free error. Adding every orphan to the free list restores the invariant that each block is either claimed once or free.",
        complexityRationale:
            "The checker visits each block reference once and then scans the block and free arrays a constant number of times, giving linear time in the input size. It stores one integer per block, so space is linear in the block count.",
        uses: [
            "Boot-time filesystem repair utilities",
            "Storage engines validating on-disk metadata after a crash",
            "Forensic recovery of damaged volume structures",
        ],
        references: [
            "Katcher, Postmark: A New File System Benchmark, 1997",
            "Wikipedia, File system consistency check",
        ],
        workedExample:
            "With eight blocks, inodes claiming [0,1,2], [3,4] and [2,9], and free list [5,6], block 2 has count two (cross-link), block 9 is out of range, and block 7 is an orphan. Repair adds 7 to the free list to get [5,6,7].",
    },
    id: "fsck-checking",
    name: "Filesystem Consistency Checking (fsck)",
    category: "production-systems",
    complexity: { time: "O(B + R + F)", space: "O(B)" },
    defaultInput: {
        totalBlocks: 8,
        inodes: [
            { id: 1, blocks: [0, 1, 2], links: 1 },
            { id: 2, blocks: [3, 4], links: 1 },
            { id: 3, blocks: [2, 9], links: 2 },
        ],
        free: [5, 6],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "zero the reference count of every block",
        "for each inode and each block it references",
        "increment that block's count if the block is in range",
        "record any out-of-range reference as missing",
        "flag blocks whose count exceeds one as cross-links",
        "flag unclaimed blocks absent from the free list as orphans",
        "flag claimed blocks that are also free as double-free",
        "add each orphan back to the free list",
        "done: report all problems and the repaired free list",
    ],
};

export default module;
