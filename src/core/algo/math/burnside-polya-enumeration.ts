/**
 * burnside-polya-enumeration.ts - Burnside Lemma and Polya Counting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Burnside's lemma counts the orbits of a group action as the average number
 * of colorings fixed by each group element. For n beads and c colors, the
 * cyclic group contributes c^gcd(n,k) for each rotation k, and the dihedral
 * group adds the reflection fixed-point counts. Polya's cycle index packages
 * the same information as a polynomial in variables a_j tracking j-cycles.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) group elements for the cyclic group, O(n) with reflections
 *   Space: O(n) for the fixed-point table and cycle-index terms
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame shows one group element, its cycle count, and fixed colorings.
 *   - Rotation elements are GREY, reflection elements are comparing.
 *   - The final frame reports the orbit count and the average fixed count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GroupElement {
    label: string;
    kind: "rotation" | "reflection";
    cycles: number;
    fixed: number;
}

function gcd(a: number, b: number): number {
    let x = a;
    let y = b;
    while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

/** Elements of the cyclic group C_n acting on n bead positions. */
function rotations(n: number, colors: number): GroupElement[] {
    return Array.from({ length: n }, (_, k) => {
        const cycles = gcd(n, k);
        return {
            label: `rot ${k}`,
            kind: "rotation" as const,
            cycles,
            fixed: colors ** cycles,
        };
    });
}

/** Reflection elements of the dihedral group D_n. */
function reflections(n: number, colors: number): GroupElement[] {
    const elements: GroupElement[] = [];
    if (n % 2 === 1) {
        for (let k = 0; k < n; k += 1) {
            const cycles = (n + 1) / 2;
            elements.push({
                label: `refl ${k}`,
                kind: "reflection",
                cycles,
                fixed: colors ** cycles,
            });
        }
    } else {
        for (let k = 0; k < n / 2; k += 1) {
            const cycles = n / 2 + 1;
            elements.push({
                label: `refl-v ${k}`,
                kind: "reflection",
                cycles,
                fixed: colors ** cycles,
            });
        }
        for (let k = 0; k < n / 2; k += 1) {
            const cycles = n / 2;
            elements.push({
                label: `refl-e ${k}`,
                kind: "reflection",
                cycles,
                fixed: colors ** cycles,
            });
        }
    }
    return elements;
}

function elementCells(elements: GroupElement[], active: number): VisualEntity[] {
    return elements
        .map((element, index) => [
            {
                id: `cell-${index}-label`,
                type: "cell" as const,
                label: element.label,
                value: 0,
                state: (index === active ? "active" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: index, col: 0 },
            },
            {
                id: `cell-${index}-cycles`,
                type: "cell" as const,
                label: `cycles ${element.cycles}`,
                value: element.cycles,
                state: (index === active ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: index, col: 1 },
            },
            {
                id: `cell-${index}-fixed`,
                type: "cell" as const,
                label: `${element.fixed}`,
                value: element.fixed,
                state: (index === active ? "sorted" : "unvisited") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: index, col: 2 },
            },
        ])
        .flat();
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { beads?: number; colors?: number; reflections?: boolean } | null) ?? {};
    const n = typeof task.beads === "number" ? Math.max(1, Math.trunc(task.beads)) : 6;
    const colors = typeof task.colors === "number" ? Math.max(1, Math.trunc(task.colors)) : 3;
    const withReflections = task.reflections === true;
    let step = 0;

    yield {
        stepNumber: step,
        entities: [
            {
                id: "cell-setup",
                type: "cell",
                label: `${n} beads, ${colors} colors`,
                value: n,
                state: "highlight",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            },
        ],
        edges: [],
        description: `Counting distinct colorings of ${n} beads with ${colors} colors under ${withReflections ? "rotations and reflections" : "rotations only"}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, beads: n, colors, withReflections },
    };
    step += 1;

    const elements = [...rotations(n, colors), ...(withReflections ? reflections(n, colors) : [])];
    const groupSize = elements.length;

    for (let index = 0; index < elements.length; index += 1) {
        const element = elements[index]!;
        yield {
            stepNumber: step,
            entities: elementCells(elements, index),
            edges: [],
            description: `${element.label} has ${element.cycles} cycles, so it fixes ${colors}^${element.cycles} = ${element.fixed} colorings.`,
            codeLineNumber: element.kind === "rotation" ? 2 : 3,
            layout: "grid",
            meta: {
                step,
                element: element.label,
                kind: element.kind,
                cycles: element.cycles,
                fixed: element.fixed,
            },
        };
        step += 1;
    }

    const totalFixed = elements.reduce((sum, element) => sum + element.fixed, 0);
    const orbits = totalFixed / groupSize;
    const cycleIndex = elements.map((element) => `a1^${element.cycles}`).join(" + ");
    yield {
        stepNumber: step,
        entities: elementCells(elements, -1),
        edges: [],
        description: `Burnside average: ${totalFixed} fixed colorings divided by ${groupSize} group elements gives ${orbits} distinct colorings.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            step,
            orbits,
            groupSize,
            totalFixed,
            fixedCounts: elements.map((element) => element.fixed),
            cycleIndex: `1/${groupSize} (${cycleIndex})`,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of listing every coloring and deciding which ones are the same under rotation or reflection, Burnside averages the number of colorings left unchanged by each symmetry. A symmetry with many independent cycles leaves many colorings fixed, and the average of those fixed counts is exactly the number of essentially different patterns. Polya's theorem records the same cycle structure as a polynomial.",
        invariants: [
            "A group element fixes a coloring exactly when the coloring is constant on each of its cycles.",
            "A rotation by k positions on n beads has gcd(n, k) cycles.",
            "The total number of fixed colorings summed over the group is divisible by the group size.",
        ],
        correctness:
            "Each orbit contributes the same number of pairs (g, coloring) with g fixing that coloring as the group size, because the stabilizer sizes within an orbit are constant and equal by the orbit-stabilizer theorem. Summing fixed colorings over all group elements therefore equals the group size times the number of orbits, so dividing gives the orbit count. For rotations the cycles are the gcd(n, k) residue classes modulo that gcd; for reflections the cycle counts are the standard vertex or edge axis counts, so the fixed-point tally is exact.",
        complexityRationale:
            "The cyclic group has n elements and the dihedral group has 2n; each element needs one gcd and one exponentiation with small integers, so the time is O(n) and the fixed-point table uses O(n) space. The brute-force verification used in teaching compares against all c^n colorings but is not part of the counting algorithm.",
        uses: [
            "Counting distinct necklaces, bracelets, and rotational patterns",
            "Enumerating chemical isomers under molecular symmetry",
            "Counting inequivalent Boolean functions in circuit design",
        ],
        references: [
            "Burnside, Theory of Groups of Finite Order, 1911",
            "Polya, Kombinatorische Anzahlbestimmungen fur Gruppen, Graphen und chemische Verbindungen, 1937",
        ],
        workedExample:
            "For a hexagon with three colors under rotation only, the six rotations have cycle counts 6, 1, 2, 3, 2, 1, fixing 729, 3, 9, 27, 9 and 3 colorings. Their sum is 780; dividing by six gives 130 distinct necklaces.",
    },
    id: "burnside-polya-enumeration",
    name: "Burnside-Polya Enumeration",
    category: "math",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { beads: 6, colors: 3, reflections: false },
    visualType: "grid",
    run,
    pseudocode: [
        "input the number of beads and colors",
        "list each group element and its permutation cycles",
        "for each rotation compute gcd of n and its shift",
        "for each reflection count its vertex or edge cycles",
        "add colors raised to the cycle count for each element",
        "sum the fixed-coloring counts over the whole group",
        "divide the sum by the group size",
        "done: the number of distinct colorings",
    ],
};

export default module;
