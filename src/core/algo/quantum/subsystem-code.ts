/**
 * subsystem-code.ts - Subsystem (Gauge) Code Structure
 *
 * A subsystem code is described by a gauge group G of Pauli operators. Its
 * stabilizer group S is the center of G inside G, and the remaining gauge
 * degrees of freedom protect no information. With n qubits, gauge rank g and
 * stabilizer rank s, the code carries k = n - (g+s)/2 logical qubits and
 * (g-s)/2 gauge qubits. This module derives those numbers by exact GF(2)
 * symplectic linear algebra over small Pauli groups.
 *
 * Limit: at most 5 qubits and 6 independent generators; global phases ignored.
 *
 * Time:  O(2^g * g + 4^n) for small g and n
 * Space: O(2^g + 4^n) for the enumerated groups
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface GeneratorSpec {
    x: number[];
    z: number[];
    label?: string;
}

function parity(v: number): number {
    let count = 0;
    while (v > 0) {
        count ^= v & 1;
        v >>>= 1;
    }
    return count;
}

function gf2Rank(values: number[]): number {
    let rank = 0;
    const pivots: number[] = [];
    for (const value of values) {
        let v = value;
        for (const pivot of pivots) v = Math.min(v, v ^ pivot);
        if (v > 0) {
            pivots.push(v);
            pivots.sort((a, b) => b - a);
            rank += 1;
        }
    }
    return rank;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; generators?: GeneratorSpec[] } | null) ?? {};
    const n = typeof task.n === "number" ? Math.min(5, Math.max(1, task.n)) : 4;
    const specs: GeneratorSpec[] = (task.generators ?? [
        { x: [1, 1, 0, 0], z: [0, 0, 0, 0], label: "X1 X2" },
        { x: [0, 0, 0, 0], z: [0, 1, 1, 0], label: "Z2 Z3" },
        { x: [0, 0, 1, 1], z: [0, 0, 0, 0], label: "X3 X4" },
    ]).slice(0, 6);
    const maskN = (1 << n) - 1;

    const toBits = (spec: GeneratorSpec): number => {
        let bits = 0;
        for (let i = 0; i < n; i += 1) {
            if (spec.x[i]) bits |= 1 << i;
            if (spec.z[i]) bits |= 1 << (n + i);
        }
        return bits;
    };
    const generators = specs.map(toBits);
    const commutes = (a: number, b: number): boolean => {
        const first = parity(a & ((b >> n) & maskN));
        const second = parity(((a >> n) & maskN) & (b & maskN));
        return (first ^ second) === 0;
    };

    const enumerateGroup = (gens: number[]): number[] => {
        const group = new Set<number>([0]);
        for (const gen of gens) {
            const next = new Set<number>(group);
            for (const element of group) next.add(element ^ gen);
            for (const element of next) group.add(element);
        }
        return [...group].sort((a, b) => a - b);
    };

    const centerOf = (gens: number[], group: number[]): number[] =>
        group.filter((element) => gens.every((gen) => commutes(element, gen)));

    const rankOf = (gens: number[]): number => gf2Rank(gens);

    const centralizerSize = (center: number[]): number => {
        let count = 0;
        for (let value = 0; value < 1 << (2 * n); value += 1) {
            if (center.every((stabilizer) => commutes(value, stabilizer))) count += 1;
        }
        return count;
    };

    const fullGroup = enumerateGroup(generators);
    const center = centerOf(generators, fullGroup);
    const g = rankOf(generators);
    const s = center.length > 0 && (center.length & (center.length - 1)) === 0 ? Math.log2(center.length) : 0;
    const rankB = g - s;
    const gaugeQubits = rankB / 2;
    const k = n - s - gaugeQubits;
    const centralizer = centralizerSize(center);
    const consistent = rankB % 2 === 0 && k >= 0 && centralizer === 1 << (2 * n - s);

    const makeCells = (gens: number[], groupSize: number, centerSize: number, extra: Array<[string, string]>): VisualEntity[] => {
        const fields: Array<[string, string]> = [
            ...gens.map((_, i): [string, string] => [`generator ${i + 1}`, specs[i]?.label ?? `g${i + 1}`]),
            ["|G|", String(groupSize)],
            ["|S|", String(centerSize)],
            ...extra,
        ];
        return fields.map(([label, value], index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${label}: ${value}`,
            value,
            state: index === fields.length - 1 ? ("active" as const) : ("idle" as const),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, field: label },
        }));
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells([], 1, 1, [["n", String(n)]]),
        edges: [],
        description: `Starting with ${n} qubit(s) and ${specs.length} gauge generator(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: 4, n, generators: specs.length, consistent },
    };
    step += 1;

    for (let i = 1; i <= generators.length; i += 1) {
        const prefix = generators.slice(0, i);
        const group = enumerateGroup(prefix);
        const centerPrefix = centerOf(prefix, group);
        yield {
            stepNumber: step,
            entities: makeCells(prefix, group.length, centerPrefix.length, [["prefix", String(i)]]),
            edges: [],
            description: `Adding generator ${i} gives a gauge group of ${group.length} element(s) with a center of ${centerPrefix.length} element(s).`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: 1, cols: i + 3, prefix: i, groupSize: group.length, centerSize: centerPrefix.length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(generators, fullGroup.length, center.length, [
            ["rank(G)", String(g)],
            ["rank(S)", String(s)],
            ["logical k", String(k)],
            ["gauge qubits", String(gaugeQubits)],
        ]),
        edges: [],
        description: `Subsystem code: n=${n}, rank(G)=${g}, rank(S)=${s}, logical qubits=${k}, gauge qubits=${gaugeQubits}; consistency ${consistent ? "passed" : "failed"}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: 1,
            cols: generators.length + 7,
            n,
            gaugeRank: g,
            stabilizerRank: s,
            logicalQubits: k,
            gaugeQubits,
            centerSize: center.length,
            centralizerSize: centralizer,
            consistent,
        },
    };
}

const module: AlgorithmModule = {
    id: "subsystem-code",
    name: "Subsystem Code Structure (Gauge Group)",
    category: "quantum",
    complexity: { time: "O(2^g * g + 4^n)", space: "O(2^g + 4^n)" },
    defaultInput: {
        n: 4,
        generators: [
            { x: [1, 1, 0, 0], z: [0, 0, 0, 0], label: "X1 X2" },
            { x: [0, 0, 0, 0], z: [0, 1, 1, 0], label: "Z2 Z3" },
            { x: [0, 0, 1, 1], z: [0, 0, 0, 0], label: "X3 X4" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "encode each Pauli generator as a binary symplectic vector",
        "enumerate every element of the gauge group G by XOR combinations",
        "collect the elements of G that commute with every generator into S",
        "compute the GF(2) rank g of the generators and the rank s of S",
        "check that g minus s is even, which counts gauge degrees of freedom",
        "set gauge qubits to (g-s)/2 and logical qubits to n-s-(g-s)/2",
        "count all Paulis commuting with S and confirm it equals 2^(2n-s)",
        "done: report ranks, logical qubits, and gauge qubits",
    ],
    education: {
        intuition:
            "A subsystem code deliberately leaves some degrees of freedom uncorrected. Those gauge degrees are easier to protect than real logical qubits, so the code can use simpler measurements. The stabilizer group is exactly the part of the gauge group that commutes with everything else; it is the part that can actually detect errors.",
        invariants: [
            "Every element of S commutes with every generator of G by construction.",
            "The symplectic commutator is a bilinear alternating form over GF(2).",
            "The stabilizer rank s plus the gauge qubits plus the logical qubits equals n.",
        ],
        correctness:
            "The alternating commutation form has even rank on the gauge group, so g - s = 2*(g-s)/2 is even. The quotient G/S is generated by the gauge qubits and carries 2^(g-s) operators, matching 4 raised to the number of gauge qubits. The centralizer of S in the full Pauli group has size 2^(2n-s), which is checked by brute force. Solving n = s + gaugeQubits + logicalQubits gives the stated k.",
        complexityRationale:
            "Enumerating the gauge group costs O(2^g) scalar XOR operations and testing the center costs O(2^g * g). Counting the centralizer scans all 4^n Paulis. Both exponents are tiny for the stated limit of five qubits and six generators.",
        uses: [
            "Fault-tolerant quantum memory with low-weight gauge measurements",
            "Subsystem surface codes and gauge color codes",
            "Teaching the separation between stabilizer and gauge degrees of freedom",
        ],
        references: [
            "Kitaev, Shen, and Vyalyi, Classical and Quantum Computation, lecture 12",
            "Poulin, Stabilizer Formalism for Operator Quantum Error Correction, 2008",
        ],
        workedExample:
            "On four qubits take generators X1X2, Z2Z3, X3X4. The gauge group has 8 elements and its center has 2, so g = 3 and s = 1. Then g - s = 2 gives one gauge qubit, and k = 4 - 1 - 1 = 2 logical qubits. The centralizer of the center contains 2^(8-1) = 128 Paulis.",
    },
};

export default module;
