/**
 * raptor-code.ts - Raptor Fountain Code (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Raptor code first protects a block of source symbols with a sparse outer
 * precode, then emits an unlimited stream of droplets from the combined
 * symbols. Each droplet is the xor of a small randomly chosen subset. A receiver
 * that collects enough droplets solves the resulting xor equations; the outer
 * precode means only a little more than the original number of symbols is
 * needed, with high probability. This teaching model uses byte symbols and a
 * deterministic seed so every step can be replayed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(drops * degree) to encode, O(n cubed) to solve with n = k + m
 *   Space: O(n + drops) for the equations and droplets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show source symbols, repair symbols, droplets, and recovered bytes.
 *   - Droplet bars are active while generated; recovered source bars are green.
 *   - meta carries the symbol values, droplet values, rank, and success flag.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface Droplet {
    id: number;
    coeff: bigint;
    value: number;
}

export interface Gf2Row {
    coeff: bigint;
    rhs: number;
}

/** Solve a system of xor equations over GF(2), with byte right-hand sides. */
export function solveGF2(rows: Gf2Row[], n: number): number[] | null {
    const work = rows.map((row) => ({ coeff: row.coeff, rhs: row.rhs }));
    const pivotRow: Array<number | undefined> = Array.from({ length: n }, () => undefined);
    let rank = 0;
    for (let col = 0; col < n; col += 1) {
        const bit = 1n << BigInt(col);
        let found = -1;
        for (let i = rank; i < work.length; i += 1) {
            if ((work[i]!.coeff & bit) !== 0n) {
                found = i;
                break;
            }
        }
        if (found < 0) continue;
        const pivot = work[found]!;
        work[found] = work[rank]!;
        work[rank] = pivot;
        for (let i = 0; i < work.length; i += 1) {
            if (i !== rank && (work[i]!.coeff & bit) !== 0n) {
                work[i] = { coeff: work[i]!.coeff ^ pivot.coeff, rhs: work[i]!.rhs ^ pivot.rhs };
            }
        }
        pivotRow[col] = rank;
        rank += 1;
    }
    for (let i = rank; i < work.length; i += 1) {
        if (work[i]!.coeff === 0n && work[i]!.rhs !== 0) return null;
    }
    if (rank < n) return null;
    return Array.from({ length: n }, (_, col) => work[pivotRow[col]!]!.rhs);
}

function nextRandom(state: number): number {
    return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

/** Build the outer precode repair symbols. */
export function raptorPrecode(source: number[], m: number): number[] {
    return Array.from({ length: m }, (_, j) => {
        let value = 0;
        for (let i = 0; i < source.length; i += 1) {
            if (i % (j + 2) === j % (j + 2)) value ^= source[i] ?? 0;
        }
        return value;
    });
}

/** Generate deterministic droplets from the source plus precode symbols. */
export function raptorEncode(source: number[], seed: number, drops: number, m = 2): Droplet[] {
    const repair = raptorPrecode(source, m);
    const symbols = [...source, ...repair];
    const n = symbols.length;
    let state = (seed >>> 0) || 1;
    return Array.from({ length: drops }, (_, id) => {
        const degree = 2 + (id % 3);
        const chosen = new Set<number>();
        let value = 0;
        let attempts = 0;
        while (chosen.size < degree && attempts < degree * 20) {
            state = nextRandom(state);
            const index = state % n;
            if (!chosen.has(index)) {
                chosen.add(index);
                value ^= symbols[index] ?? 0;
            }
            attempts += 1;
        }
        let coeff = 0n;
        for (const index of chosen) coeff |= 1n << BigInt(index);
        return { id, coeff, value };
    });
}

/** Recover the source bytes by solving the droplet system over GF(2). */
export function raptorDecode(droplets: Droplet[], k: number, m = 2): { source: number[]; success: boolean; rank: number } {
    const n = k + m;
    const solution = solveGF2(
        droplets.map((d) => ({ coeff: d.coeff, rhs: d.value })),
        n,
    );
    if (!solution) return { source: [], success: false, rank: droplets.length };
    return { source: solution.slice(0, k), success: true, rank: n };
}

function makeBars(values: number[], labels: string[], active: number, state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels[index] ?? `${value}`,
        value,
        state: index === active ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: labels[index] ?? "", value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { source?: number[]; seed?: number; drops?: number; repair?: number } | null) ?? {};
    const source = Array.isArray(task.source) && task.source.length > 0
        ? task.source.map((v) => ((Math.floor(Number(v) || 0) % 256) + 256) % 256)
        : [12, 25, 37, 48];
    const seed = Math.floor(Number(task.seed ?? 7)) || 7;
    const repairCount = Math.max(1, Math.floor(Number(task.repair ?? 2)) || 2);
    const drops = Math.max(source.length + repairCount, Math.floor(Number(task.drops ?? source.length + repairCount + 10)) || source.length + repairCount + 10);
    const droplets = raptorEncode(source, seed, drops, repairCount);
    const decoded = raptorDecode(droplets, source.length, repairCount);
    const repair = raptorPrecode(source, repairCount);
    let stepNumber = 0;

    yield {
        stepNumber: stepNumber,
        entities: makeBars(source, source.map((_, i) => `s${i}`), -1, "idle"),
        edges: [],
        description: `Raptor code with ${source.length} source symbol(s), ${repairCount} repair symbol(s), and ${drops} droplet(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { source: [...source], repair: [], droplets: [], decoded: [], success: false, rank: 0 },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars([...source, ...repair], [...source.map((_, i) => `s${i}`), ...repair.map((_, i) => `r${i}`)], source.length, "visited"),
        edges: [],
        description: `The outer precode adds ${repairCount} repair symbol(s) to the source block.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { source: [...source], repair, droplets: [], decoded: [], success: false, rank: 0 },
    };
    stepNumber += 1;

    for (let i = 0; i < droplets.length; i += 1) {
        const droplet = droplets[i]!;
        yield {
            stepNumber: stepNumber,
            entities: makeBars(droplets.slice(0, i + 1).map((d) => d.value), droplets.slice(0, i + 1).map((d) => `d${d.id}`), i, "active"),
            edges: [],
            description: `Droplet ${i} xor-combines ${(droplet.coeff.toString(2).match(/1/g) ?? []).length} intermediate symbol(s) into ${droplet.value}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                source: [...source],
                repair,
                droplets: droplets.slice(0, i + 1).map((d) => d.value),
                decoded: [],
                success: false,
                rank: 0,
            },
        };
        stepNumber += 1;
    }

    yield {
        stepNumber: stepNumber,
        entities: makeBars(droplets.map((d) => d.value), droplets.map((d) => `d${d.id}`), -1, "sorted"),
        edges: [],
        description: `Collected ${drops} droplet(s); solving the xor system over ${source.length + repairCount} unknowns.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { source: [...source], repair, droplets: droplets.map((d) => d.value), decoded: [], success: false, rank: 0 },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars(decoded.source, decoded.source.map((_, i) => `s${i}`), -1, decoded.success ? "sorted" : "error"),
        edges: [],
        description: decoded.success
            ? `Decoding succeeded: ${source.length} source symbol(s) recovered.`
            : `Decoding needs more droplets; ${drops} equation(s) were not enough.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            source: [...source],
            repair,
            droplets: droplets.map((d) => d.value),
            decoded: decoded.source,
            success: decoded.success ? 1 : 0,
            rank: decoded.rank,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat each source byte as an unknown and each droplet as an equation that xors a few unknowns together and reveals the result. If you collect more independent equations than there are unknowns, Gaussian elimination over xor recovers every symbol. The outer precode adds a few extra symbols so that the random droplet equations are almost always independent enough to succeed with only a small overhead.",
        invariants: [
            "Every droplet value is the xor of the symbols selected by its coefficient mask.",
            "The coefficient mask has one bit per source and repair symbol.",
            "A full-rank droplet system decodes to exactly the original source bytes.",
        ],
        correctness:
            "Gaussian elimination over GF(2) finds a pivot for every unknown when the collected coefficient vectors are independent. Each pivot row then contains a single unknown, whose value is its right-hand side. Because the droplets were built from the true symbols, the recovered vector satisfies every equation and equals the original block; with fewer independent equations the system is underdetermined and decoding correctly reports failure.",
        complexityRationale:
            "Encoding each droplet scans at most a small degree of symbols, so generation is linear in the number of droplets. Solving uses Gaussian elimination on a matrix with one column per source and repair symbol, costing cubic time in that count; the stored droplets and matrix take linear space.",
        uses: [
            "Reliable multicast and broadcast over lossy networks",
            "Distributed storage with repairable fragments",
            "Teaching erasure coding and fountain code decoding",
        ],
        references: [
            "Shokrollahi, Raptor Codes, IEEE Transactions on Information Theory, 2006",
            "Luby, LT Codes, FOCS, 2002",
        ],
        workedExample:
            "From source bytes 12 and 25 with two repair bytes, suppose one droplet xors symbol zero and symbol one to give 21. A second droplet xors only symbol zero and gives 12. The second equation fixes the first symbol at 12, and substituting into the first gives the second symbol as 21 xor 12, which is 25.",
    },
    id: "raptor-code",
    name: "Raptor Fountain Code (Teaching Model)",
    category: "production-systems",
    complexity: { time: "O(d * deg + n^3)", space: "O(n + d)" },
    defaultInput: { source: [12, 25, 37, 48], seed: 7, repair: 2, drops: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "split the source block into byte symbols",
        "compute sparse repair symbols with the outer precode",
        "for each requested droplet choose a small random subset",
        "xor those symbols into the droplet value",
        "collect droplets until the equation system has full rank",
        "eliminate variables over xor to find each pivot",
        "read off the recovered source symbols",
        "done: report the decoded block and success verdict",
    ],
};

export default module;
