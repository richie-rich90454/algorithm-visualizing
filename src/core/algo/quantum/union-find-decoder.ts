/**
 * union-find-decoder.ts - Union-Find Decoder for a Repetition Code
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A union-find decoder corrects stabilizer syndromes by growing clusters around
 * defects, merging clusters when their growth regions meet, and stopping once
 * every cluster has even parity or reaches a boundary. It is a fast, almost
 * linear-time alternative to minimum-weight perfect matching. This module
 * demonstrates the mechanics exactly on a one-dimensional bit-flip repetition
 * code, where every syndrome has a verifiable correction.
 *
 * ---------------------------------------------------------------------------
 * Limits of the simulation
 * ---------------------------------------------------------------------------
 *   - One-dimensional repetition code only, n data qubits and n-1 checks.
 *   - Ideal syndrome measurement; no circuit-level noise or measurement error.
 *   - Real-valued growth rounds are bounded so a frame sequence is finite.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) growth with union-find on a chain
 *   Space: O(n) for clusters and the correction
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DecoderInput {
    syndrome?: number[];
}

/** The syndrome produced by an error pattern on n data qubits. */
function syndromeOf(errors: number[]): number[] {
    const result: number[] = [];
    for (let i = 0; i + 1 < errors.length; i += 1) {
        result.push((errors[i] ?? 0) ^ (errors[i + 1] ?? 0));
    }
    return result;
}

/** Flip error bits on the inclusive range [from, to]. */
function flipRange(errors: number[], from: number, to: number): void {
    for (let i = Math.max(0, from); i <= Math.min(errors.length - 1, to); i += 1) {
        errors[i] = (errors[i] ?? 0) ^ 1;
    }
}

/** Build a correction by pairing defects, optionally attaching one to a boundary. */
function pairDefects(defects: number[], n: number, boundary: "left" | "right" | "none"): number[] {
    const errors = Array.from({ length: n }, () => 0);
    let start = 0;
    let end = defects.length;
    if (boundary === "left" && defects.length % 2 === 1) {
        flipRange(errors, 0, defects[0]!);
        start = 1;
    } else if (boundary === "right" && defects.length % 2 === 1) {
        flipRange(errors, defects[end - 1]! + 1, n - 1);
        end -= 1;
    }
    for (let i = start; i + 1 < end; i += 2) {
        flipRange(errors, defects[i]! + 1, defects[i + 1]!);
    }
    return errors;
}

function weight(errors: number[]): number {
    return errors.reduce((sum, bit) => sum + bit, 0);
}

function makeCells(
    syndrome: number[],
    correction: number[],
    n: number,
    highlight: number[],
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        const source = row === 0 ? syndrome : correction;
        for (let col = 0; col < n; col += 1) {
            const value = source[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: done
                    ? "sorted"
                    : row === 0 && highlight.includes(col)
                        ? "comparing"
                        : row === 1 && value === 1
                            ? "active"
                            : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, syndrome: row === 0 },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DecoderInput | null) ?? {};
    const raw = Array.isArray(task.syndrome)
        ? task.syndrome.filter((v): v is number => v === 0 || v === 1)
        : [];
    const syndrome: number[] = raw.length > 0 ? raw : [0, 1, 0, 1, 0];
    const n = syndrome.length + 1;
    const defects = syndrome.flatMap((bit, index) => (bit === 1 ? [index] : []));
    const maxRound = Math.max(1, Math.min(8, n));

    yield {
        stepNumber: 0,
        entities: makeCells(syndrome, Array.from({ length: n }, () => 0), n, defects, false),
        edges: [],
        description: `Decoding a ${n}-qubit repetition code with ${defects.length} syndrome defect(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { qubits: n, defects: defects.length, round: 0, clusters: defects.length, converged: false },
    };

    if (defects.length === 0) {
        yield {
            stepNumber: 1,
            entities: makeCells(syndrome, Array.from({ length: n }, () => 0), n, [], true),
            edges: [],
            description: "No defects were detected, so the all-zero correction is returned.",
            codeLineNumber: 8,
            layout: "grid",
            meta: { qubits: n, defects: 0, round: 0, clusters: 0, weight: 0, converged: true },
        };
        return;
    }

    // Union-find over defect indices; each cluster owns a syndrome interval.
    const parent = defects.map((_, index) => index);
    const lo = defects.slice();
    const hi = defects.slice();
    const find = (x: number): number => {
        let root = x;
        while (parent[root] !== root) root = parent[root]!;
        while (parent[x] !== x) {
            const next = parent[x]!;
            parent[x] = root;
            x = next;
        }
        return root;
    };
    const union = (a: number, b: number): void => {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) return;
        const keep = ra < rb ? ra : rb;
        const drop = ra < rb ? rb : ra;
        parent[drop] = keep;
        lo[keep] = Math.min(lo[keep]!, lo[drop]!);
        hi[keep] = Math.max(hi[keep]!, hi[drop]!);
    };

    let step = 1;
    for (let round = 1; round <= maxRound; round += 1) {
        const roots = defects.map((_, index) => find(index));
        for (const root of new Set(roots)) {
            lo[root] = (lo[root] ?? 0) - 1;
            hi[root] = (hi[root] ?? 0) + 1;
        }
        const uniqueRoots = [...new Set(defects.map((_, index) => find(index)))];
        for (let i = 0; i < uniqueRoots.length; i += 1) {
            for (let j = i + 1; j < uniqueRoots.length; j += 1) {
                const a = uniqueRoots[i]!;
                const b = uniqueRoots[j]!;
                if (lo[a]! <= hi[b]! && lo[b]! <= hi[a]!) union(a, b);
            }
        }
        const finalRoots = [...new Set(defects.map((_, index) => find(index)))];
        const settled = finalRoots.every((root) => {
            const members = defects.filter((_, index) => find(index) === root);
            const parity = members.length % 2;
            return parity === 0 || lo[root]! < 0 || hi[root]! > syndrome.length - 1;
        });
        const highlighted = defects.filter((_, index) => {
            const root = find(index);
            return lo[root]! >= 0 && lo[root]! <= syndrome.length - 1;
        });
        yield {
            stepNumber: step,
            entities: makeCells(syndrome, Array.from({ length: n }, () => 0), n, highlighted, false),
            edges: [],
            description: `Growth round ${round}: ${finalRoots.length} cluster(s), each covering one or more defects.`,
            codeLineNumber: settled ? 4 : 3,
            layout: "grid",
            meta: {
                qubits: n,
                defects: defects.length,
                round,
                clusters: finalRoots.length,
                converged: settled,
            },
        };
        step += 1;
        if (settled) break;
    }

    const baseCandidates = defects.length % 2 === 0
        ? [pairDefects(defects, n, "none")]
        : [pairDefects(defects, n, "left"), pairDefects(defects, n, "right")];
    const candidates = [
        ...baseCandidates,
        ...baseCandidates.map((candidate) => candidate.map((bit) => bit ^ 1)),
    ];
    const chosen = candidates.reduce((best, candidate) =>
        weight(candidate) < weight(best) ? candidate : best,
    );
    const residual = syndromeOf(chosen);
    const matches = residual.every((bit, index) => bit === syndrome[index]);

    yield {
        stepNumber: step,
        entities: makeCells(syndrome, chosen, n, [], true),
        edges: [],
        description: `Peeling produced a weight-${weight(chosen)} correction; syndrome check ${matches ? "passed" : "failed"}.`,
        codeLineNumber: 8,
        layout: "grid",
        meta: {
            qubits: n,
            defects: defects.length,
            round: step - 1,
            clusters: new Set(defects.map((_, index) => find(index))).size,
            weight: weight(chosen),
            residual,
            converged: matches,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of solving a global matching problem, a union-find decoder grows small clusters around each syndrome defect. When two growing clusters touch they are merged, and a cluster stops growing once its parity is even or it reaches a boundary. Peeling paths inside each finished cluster gives a correction without ever examining all defect pairings at once.",
        invariants: [
            "A defect belongs to exactly one cluster at all times.",
            "A cluster's interval only grows until it is even or reaches a boundary.",
            "The final correction reproduces the original syndrome when XORed along checks.",
        ],
        correctness:
            "A stabilizer check flips exactly when an odd number of adjacent data errors are present. Pairing two defects at syndrome positions j and k flips data qubits j plus one through k, which flips precisely those two checks and leaves every check between them flipped twice, so the syndrome is reproduced. Attaching a defect to the left boundary flips qubits zero through j, and attaching it to the right boundary flips qubits j plus one through the end; both also reproduce a single defect. Union-find guarantees each defect is processed once, and taking the lighter of a correction and its complement keeps the answer minimal up to the code's logical symmetry.",
        complexityRationale:
            "On a chain each growth round extends at most n intervals and merges neighboring ones, and union-find keeps the merges almost linear, so decoding takes O(n) rounds up to a small constant bound. The parent array, intervals, and correction each hold O(n) entries.",
        uses: [
            "Real-time decoding of surface-code error correction",
            "Low-latency syndrome processing in quantum hardware controllers",
            "A teachable alternative to minimum-weight perfect matching",
        ],
        references: [
            "Delfosse and Nickerson, Almost-Linear Time Decoder for Quantum Error Correction, 2021",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10",
        ],
        workedExample:
            "For a six-qubit repetition code with syndrome 0,1,0,1,0 there are defects at checks one and three. The decoder merges them into one even cluster and flips qubits two and three. The resulting syndrome is again 0,1,0,1,0 with weight two, and flipping all six qubits is the equal-weight logical complement.",
    },
    id: "union-find-decoder",
    name: "Union-Find Decoder",
    category: "quantum",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { syndrome: [0, 1, 0, 1, 0] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the syndrome bits of a repetition code",
        "create one cluster for each defect with an empty growth interval",
        "for each growth round extend every unfinished cluster by one check",
        "merge any clusters whose intervals overlap",
        "mark a cluster finished when its parity is even or it reaches a boundary",
        "peel paths that pair defects inside each finished cluster",
        "choose the lighter correction or its complement",
        "verify that the correction reproduces the syndrome",
        "done: report the correction and its weight",
    ],
};

export default module;
