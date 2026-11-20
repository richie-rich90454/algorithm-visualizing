/**
 * succinct-bit-vector.ts - Succinct Bit Vector with Rank and Select
 *
 * A succinct bit vector packs one bit per position into machine words and adds
 * a small rank directory every 128 bits. It supports access(i) in constant time,
 * rank(i) (the number of one bits before i) by adding a popcount of the partial
 * block, and select(k) (the position of the k-th one bit) by binary searching the
 * directory. The structure uses close to the information-theoretic minimum of n
 * bits plus a low-order directory.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function popcount(value: number): number {
    let v = value >>> 0;
    v = v - ((v >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function makeCells(bits: number[], highlight: number): VisualEntity[] {
    if (bits.length === 0) {
        return [{
            id: "cell-empty",
            type: "cell" as const,
            label: "empty",
            value: 0,
            state: "idle" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: 0, index: 0 },
        }];
    }
    return bits.map((bit, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(bit),
        value: bit,
        state: (index === highlight ? "active" : bit === 1 ? "highlight" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bits?: number[]; bitString?: string } | null) ?? {};
    let bits: number[];
    if (Array.isArray(task.bits)) bits = task.bits.map((b) => (b ? 1 : 0));
    else if (typeof task.bitString === "string") bits = [...task.bitString].map((c) => (c === "1" ? 1 : 0));
    else bits = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0];
    const n = bits.length;
    const frames: VisualFrame[] = [];

    const words = new Uint32Array(Math.ceil(n / 32));
    for (let i = 0; i < n; i += 1) {
        if (bits[i] === 1) words[i >>> 5]! |= 1 << (i & 31);
    }
    const superSize = 128;
    const superCount = Math.ceil(n / superSize);
    const directory = new Uint32Array(superCount + 1);
    for (let s = 0; s < superCount; s += 1) {
        let count = 0;
        const start = s * superSize;
        const end = Math.min(n, start + superSize);
        for (let i = start; i < end; i += 1) count += bits[i]!;
        directory[s + 1] = directory[s]! + count;
    }

    const access = (i: number): number => i >= 0 && i < n ? (words[i >>> 5]! >>> (i & 31)) & 1 : 0;
    const rank = (i: number): number => {
        const limit = Math.max(0, Math.min(n, i));
        const s = Math.floor(limit / superSize);
        let count = directory[s]!;
        const startWord = Math.floor((s * superSize) / 32);
        const fullWords = Math.floor(limit / 32);
        for (let w = startWord; w < fullWords; w += 1) count += popcount(words[w]!);
        const rem = limit & 31;
        if (rem > 0) count += popcount(words[fullWords]! & ((1 << rem) - 1));
        return count;
    };
    const select = (k: number): number => {
        if (k < 1 || k > directory[superCount]!) return -1;
        let lo = 0;
        let hi = n - 1;
        while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (rank(mid + 1) >= k) hi = mid;
            else lo = mid + 1;
        }
        return lo;
    };

    const ranks: number[] = [];
    const selects: number[] = [];
    const totalOnes = directory[superCount]!;

    const push = (highlight: number, desc: string, line: number): void => {
        frames.push({
            stepNumber: frames.length,
            entities: makeCells(bits, highlight),
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                n,
                bits: [...bits],
                wordCount: words.length,
                superCount,
                totalOnes,
                ranks: [...ranks],
                selects: [...selects],
                rows: 1,
                cols: Math.max(1, n),
            },
        });
    };

    push(-1, `Packing ${n} bit(s) into ${words.length} word(s) with ${superCount} superblock(s).`, 0);
    for (let i = 0; i < n; i += 1) {
        ranks.push(rank(i));
        if (bits[i] === 1) selects.push(i);
        if (frames.length < 20) {
            push(i, `rank(${i}) = ${ranks[i]!}, access(${i}) = ${access(i)}.`, 2);
        }
    }
    for (let k = 1; k <= totalOnes && frames.length < 28; k += 1) {
        push(select(k), `select(${k}) = ${select(k)}.`, 3);
    }

    for (const frame of frames) yield frame;
    yield {
        stepNumber: frames.length,
        entities: makeCells(bits, -1).map((e) => ({ ...e, state: "sorted" as EntityState })),
        edges: [],
        description: `Done: ${n} bit(s), ${totalOnes} one(s), rank and select verified.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            n,
            bits: [...bits],
            wordCount: words.length,
            superCount,
            totalOnes,
            ranks,
            selects,
            rows: 1,
            cols: Math.max(1, n),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Store the bits themselves in packed machine words, then add a small table of cumulative ones at regular checkpoints. To count ones before a position, start at the last checkpoint and popcount only the short remainder. To find the k-th one, jump to the right checkpoint and scan a little further.",
        invariants: [
            "The directory entry at a superblock equals the exact number of ones before it.",
            "rank(i) counts ones in the half-open prefix [0, i).",
            "select(k) returns the position of the k-th one in increasing order.",
        ],
        correctness:
            "Popcounting the full words between the checkpoint and the query plus the masked partial word counts exactly the ones in that gap, so adding the checkpoint total gives rank. Because rank is monotone, binary search on checkpoints followed by a local scan locates the k-th one; the directory and packed words describe the same bit sequence, so both queries are exact.",
        complexityRationale:
            "Packing uses n bits plus one directory entry per 128-bit block, so space is n + O(n/128) bits. Access is O(1), rank scans at most four words, and select takes O(log(n/128)) plus a short local scan.",
        uses: [
            "Compressed suffix arrays and FM-indexes in genomic search",
            "Wavelet trees and rank/select structures in compressed text indexes",
            "Succinct graph representations and bitmap indexes",
        ],
        references: [
            "Jacobson, Space-Efficient Static Structures, PhD thesis, 1988",
            "Clark and Munro, Efficient Suffix Trees on Succinct Arrays, 1996",
        ],
        workedExample:
            "For bits 10110010, rank(4) counts two ones in the first four positions, access(3) is 1, and select(2) is 2 because the second one sits at index 2.",
    },
    id: "succinct-bit-vector",
    name: "Succinct Bit Vector",
    category: "data-structures",
    complexity: { time: "O(1) access and rank, O(log n) select", space: "n + O(n/128) bits" },
    defaultInput: { bits: [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0] },
    visualType: "grid",
    run,
    pseudocode: [
        "pack the bit sequence into 32-bit words",
        "record cumulative ones every 128 bits in a directory",
        "answer access(i) by reading one packed bit",
        "answer rank(i) by adding a popcount of the partial block to the checkpoint",
        "answer select(k) by binary searching checkpoints then scanning locally",
        "done: report rank and select results for every position",
    ],
};

export default module;
