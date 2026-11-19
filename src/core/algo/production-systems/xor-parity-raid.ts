/**
 * xor-parity-raid.ts - XOR Parity RAID Reconstruction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A single-parity RAID group stores an extra disk whose blocks are the bitwise
 * XOR of the corresponding data blocks. If one disk fails, its contents can be
 * rebuilt by XORing the parity block with every surviving data block at that
 * position, because XOR is its own inverse.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d * w) for d data disks and w blocks per disk
 *   Space: O(w) for the parity blocks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid row per disk plus one parity row; one column per block position.
 *   - The parity row is green as it is filled, the failed row is blue when rebuilt.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    dataDisks?: number[][];
    failedDisk?: number;
}

/** Build the disk grid, marking parity and reconstruction progress. */
function makeCells(
    rows: number[][],
    parityComputed: number,
    rebuilt: boolean,
    currentCol: number,
    failedRow: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < rows.length; row += 1) {
        for (let col = 0; col < (rows[row]?.length ?? 0); col += 1) {
            let state: EntityState = "idle";
            const isParityRow = row === rows.length - 1;
            if (isParityRow && col < parityComputed) state = "sorted";
            if (isParityRow && col === currentCol) state = "comparing";
            if (!isParityRow && row === failedRow && rebuilt) state = "active";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(rows[row]?.[col] ?? 0),
                value: rows[row]?.[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

/** The XOR parity RAID generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const dataDisks: number[][] = Array.isArray(task.dataDisks) && task.dataDisks.length > 0
        ? task.dataDisks.map((disk) => disk.slice())
        : [
            [0x2a, 0x4f, 0x11, 0x9c],
            [0x13, 0x20, 0x76, 0x05],
            [0x67, 0x0d, 0x38, 0xa1],
        ];
    const width = Math.min(...dataDisks.map((disk) => disk.length));
    const failedDisk = typeof task.failedDisk === "number"
        ? Math.min(dataDisks.length - 1, Math.max(0, task.failedDisk))
        : 1;

    const parity: number[] = [];
    const rowsWithParity = [...dataDisks, parity];
    let parityComputed = 0;

    const summary = (rebuilt: boolean, reconstruction: number[]) => ({
        rows: dataDisks.length + 1,
        cols: width,
        parity: parity.slice(),
        failedDisk,
        reconstructed: reconstruction.slice(),
        original: dataDisks[failedDisk]?.slice(0, width) ?? [],
        match: rebuilt && reconstruction.every((value, i) => value === (dataDisks[failedDisk]?.[i] ?? 0)),
    });

    yield {
        stepNumber: 0,
        entities: makeCells(rowsWithParity, parityComputed, false, -1, failedDisk),
        edges: [],
        description: `Building XOR parity across ${dataDisks.length} data disks of ${width} block(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: summary(false, []),
    };
    let step = 1;

    for (let col = 0; col < width; col += 1) {
        let value = 0;
        for (const disk of dataDisks) value ^= disk[col] ?? 0;
        parity.push(value);
        parityComputed += 1;
        yield {
            stepNumber: step,
            entities: makeCells(rowsWithParity, parityComputed, false, col, failedDisk),
            edges: [],
            description: `Block ${col}: XOR of data blocks gives parity ${value}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: summary(false, []),
        };
        step += 1;
    }

    // Reconstruct the failed disk by XORing parity with all surviving disks.
    const reconstruction: number[] = [];
    const grid = dataDisks.map((disk) => disk.slice());
    for (let col = 0; col < width; col += 1) {
        let value = parity[col] ?? 0;
        for (let d = 0; d < dataDisks.length; d += 1) {
            if (d !== failedDisk) value ^= dataDisks[d]?.[col] ?? 0;
        }
        reconstruction.push(value);
        if (grid[failedDisk]) grid[failedDisk][col] = value;
    }
    yield {
        stepNumber: step,
        entities: makeCells([...grid, parity], parityComputed, true, -1, failedDisk),
        edges: [],
        description: `Rebuilt disk ${failedDisk} from parity: ${reconstruction.join(", ")}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: summary(true, reconstruction),
    };
    step += 1;

    const match = reconstruction.every((value, i) => value === (dataDisks[failedDisk]?.[i] ?? 0));
    yield {
        stepNumber: step,
        entities: makeCells([...grid, parity], parityComputed, true, -1, failedDisk),
        edges: [],
        description: match
            ? `Reconstruction verified: disk ${failedDisk} matches its original contents.`
            : `Reconstruction mismatch detected on disk ${failedDisk}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: summary(true, reconstruction),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "XOR is a simple operation with a useful property: a number XORed with itself is zero, and zero XORed with a number leaves it alone. If the parity disk holds the XOR of all data disks, then XORing that parity with every still-working disk cancels them all out and leaves exactly the missing disk behind.",
        invariants: [
            "The parity block equals the XOR of all data blocks at that position.",
            "Reconstruction XORs parity with every surviving disk exactly once.",
            "The rebuilt disk equals the original disk for every block position.",
        ],
        correctness:
            "Let P be the XOR of all data blocks D0 through Dm. For a failed disk k, XORing P with everyDi for i not equal to k gives (XOR all Di) XOR (XOR all Di for i not k). Each surviving Di appears twice and cancels to zero, leaving exactly Dk. Since XOR is associative and commutative, this reconstruction is exact for any single failed disk.",
        complexityRationale:
            "Computing parity touches every data block once and reconstruction touches every surviving block once, so time is O(d*w). Only the w parity blocks need to be retained, giving O(w) space.",
        uses: [
            "RAID 5 arrays rebuilding a failed disk",
            "Erasure coding in distributed object stores",
            "Recovering a lost shard from XOR parity in storage clusters",
        ],
        references: [
            "Patterson, Gibson, and Katz, A Case for Redundant Arrays of Inexpensive Disks, 1988",
            "Intel, RAID 5 XOR Parity Implementation Notes",
        ],
        workedExample:
            "With data blocks 0x2a, 0x13, and 0x67 at one position, parity is their XOR 0x52. If disk 1 with 0x13 fails, XORing 0x52 with 0x2a and 0x67 returns 0x13, exactly the lost value.",
    },
    id: "xor-parity-raid",
    name: "XOR Parity RAID Reconstruction",
    category: "production-systems",
    complexity: { time: "O(d*w)", space: "O(w)" },
    defaultInput: {
        dataDisks: [
            [0x2a, 0x4f, 0x11, 0x9c],
            [0x13, 0x20, 0x76, 0x05],
            [0x67, 0x0d, 0x38, 0xa1],
        ],
        failedDisk: 1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose the data disks and the block count",
        "for each block position",
        "xor the blocks from every data disk into a parity block",
        "for a failed disk xor parity with every surviving disk",
        "store the result as the reconstructed block",
        "compare the reconstruction with the original disk",
        "done: report parity and whether reconstruction succeeded",
    ],
};

export default module;
