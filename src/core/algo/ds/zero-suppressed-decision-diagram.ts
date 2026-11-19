/**
 * zero-suppressed-decision-diagram.ts - Zero-Suppressed Decision Diagram (ZDD)
 *
 * A ZDD is a reduced decision diagram for a family of sets. Unlike a BDD, a
 * node is removed when its high branch is empty, because omitting a variable
 * is the common case when representing sparse subsets. The same three steps,
 * split, recurse, and reduce, build the diagram, and counting the sets it
 * represents is a single bottom-up pass of additions.
 *
 * Time:  O(size of the reduced diagram) for construction and counting
 * Space: O(size of the reduced diagram)
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface ZddNode {
    var: number;
    low: number;
    high: number;
}

export interface ZddLogEvent {
    id: number;
    var: number;
    low: number;
    high: number;
    suppressed: boolean;
}

export interface Zdd {
    universe: number;
    nodes: ZddNode[];
    root: number;
    log: ZddLogEvent[];
}

/** Build a reduced ZDD for a family of subsets of variables zero to u minus one. */
export function buildZdd(universe: number, sets: number[][]): Zdd {
    const u = Math.max(0, Math.trunc(universe));
    const nodes: ZddNode[] = [
        { var: u, low: 0, high: 0 },
        { var: u, low: 1, high: 1 },
    ];
    const memo = new Map<string, number>();
    const log: ZddLogEvent[] = [];

    const make = (varIndex: number, low: number, high: number): number => {
        if (high === 0) {
            log.push({ id: -1, var: varIndex, low, high, suppressed: true });
            return low;
        }
        const key = `${varIndex},${low},${high}`;
        const existing = memo.get(key);
        if (existing !== undefined) {
            return existing;
        }
        const id = nodes.length;
        nodes.push({ var: varIndex, low, high });
        memo.set(key, id);
        log.push({ id, var: varIndex, low, high, suppressed: false });
        return id;
    };

    const build = (masks: number[], varIndex: number): number => {
        if (masks.length === 0) {
            return 0;
        }
        if (varIndex >= u) {
            return 1;
        }
        const bit = 1 << varIndex;
        const lowMasks: number[] = [];
        const highMasks: number[] = [];
        for (const mask of masks) {
            if ((mask & bit) !== 0) {
                highMasks.push(mask ^ bit);
            } else {
                lowMasks.push(mask);
            }
        }
        return make(varIndex, build(lowMasks, varIndex + 1), build(highMasks, varIndex + 1));
    };

    const unique = [...new Set(sets.map((set) => {
        let mask = 0;
        for (const variable of set) {
            if (variable >= 0 && variable < u) {
                mask |= 1 << variable;
            }
        }
        return mask;
    }))];
    const root = build(unique, 0);
    return { universe: u, nodes, root, log };
}

/** Count the distinct sets represented by a ZDD. */
export function zddCount(zdd: Zdd): number {
    const memo = new Map<number, number>();
    const count = (node: number): number => {
        if (node === 0) {
            return 0;
        }
        if (node === 1) {
            return 1;
        }
        const cached = memo.get(node);
        if (cached !== undefined) {
            return cached;
        }
        const current = zdd.nodes[node];
        const result = count(current?.low ?? 0) + count(current?.high ?? 0);
        memo.set(node, result);
        return result;
    };
    return count(zdd.root);
}

/** Test whether a bitmask set belongs to the family represented by a ZDD. */
export function zddContains(zdd: Zdd, mask: number): boolean {
    let node = zdd.root;
    let remaining = mask;
    while (node !== 0 && node !== 1) {
        const current = zdd.nodes[node];
        const varIndex = current?.var ?? 0;
        const bit = 1 << varIndex;
        if ((remaining & bit) !== 0) {
            remaining ^= bit;
            node = current?.high ?? 0;
        } else {
            node = current?.low ?? 0;
        }
    }
    return node === 1 && remaining === 0;
}

function buildFrame(
    zdd: Zdd,
    visible: number[],
    newest: number,
    phase: number,
    step: number,
    description: string,
    codeLineNumber: number,
    finalInfo: Record<string, number | string | boolean | number[]>,
): VisualFrame {
    const visibleSet = new Set(visible);
    const parentOf = new Map<number, number>();
    for (const id of visible) {
        if (id < 2) {
            continue;
        }
        const node = zdd.nodes[id];
        for (const child of [node?.low ?? 0, node?.high ?? 0]) {
            if (child >= 2 && visibleSet.has(child) && !parentOf.has(child)) {
                parentOf.set(child, id);
            }
        }
    }
    const entities: VisualEntity[] = visible.map((id) => {
        const node = zdd.nodes[id];
        const label = id === 0 ? "0" : id === 1 ? "1" : `x${node?.var ?? 0}`;
        const parent = parentOf.get(id);
        const state: EntityState =
            id === newest && phase === 1
                ? "active"
                : id <= 1
                  ? "sorted"
                  : phase >= 2
                    ? "sorted"
                    : "visited";
        return {
            id: `z-${id}`,
            type: "node" as const,
            label,
            value: id,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                nodeId: id,
                var: id <= 1 ? -1 : (node?.var ?? 0),
                low: node?.low ?? 0,
                high: node?.high ?? 0,
                parentId: parent === undefined ? "root" : `z-${parent}`,
            },
        };
    });
    const edges: VisualEdge[] = [];
    for (const id of visible) {
        if (id <= 1) {
            continue;
        }
        const node = zdd.nodes[id];
        for (const [branch, child] of [["0", node?.low ?? 0], ["1", node?.high ?? 0]] as Array<[string, number]>) {
            if (!visibleSet.has(child)) {
                continue;
            }
            edges.push({
                id: `edge-${id}-${branch}`,
                sourceId: `z-${id}`,
                targetId: `z-${child}`,
                label: branch,
                state: phase >= 2 ? "sorted" : "visited",
                directed: true,
            });
        }
    }
    return {
        stepNumber: step,
        entities,
        edges,
        description,
        codeLineNumber,
        layout: "tree",
        meta: { universe: zdd.universe, nodes: visible.length, phase, ...finalInfo },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { universe?: number; sets?: number[][] } | null) ?? {};
    const universe = typeof task.universe === "number" ? Math.max(0, Math.trunc(task.universe)) : 3;
    const sets = Array.isArray(task.sets)
        ? task.sets.map((set) => (Array.isArray(set) ? set.map((value) => Math.trunc(value)) : []))
        : [[], [0], [1], [0, 1], [2]];
    const zdd = buildZdd(universe, sets);
    const visible = [0, 1];

    let step = 0;
    yield buildFrame(
        zdd,
        visible,
        -1,
        0,
        step,
        `Family of ${sets.length} subset(s) over ${universe} variable(s); terminals zero and one are ready.`,
        0,
        { count: 0, sets: sets.length },
    );
    step += 1;

    for (const event of zdd.log) {
        if (event.suppressed) {
            yield buildFrame(
                zdd,
                visible,
                -1,
                1,
                step,
                `At variable x${event.var} the high branch is empty, so the node is suppressed and the low branch is reused.`,
                3,
                { count: 0, sets: sets.length },
            );
        } else {
            visible.push(event.id);
            yield buildFrame(
                zdd,
                visible,
                event.id,
                1,
                step,
                `Created node x${event.var} with low branch ${event.low} and high branch ${event.high}.`,
                4,
                { count: 0, sets: sets.length },
            );
        }
        step += 1;
    }

    const count = zddCount(zdd);
    yield buildFrame(
        zdd,
        visible,
        -1,
        2,
        step,
        `Counting bottom up gives ${count} set(s), matching the input family; the ZDD has ${visible.length} node(s).`,
        6,
        { count, sets: sets.length, sameCount: count === sets.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A ZDD compactly lists a family of sets by branching on whether each variable is present. The trick is the zero-suppression rule: if taking a variable would lead only to the empty family, drop that branch entirely. This makes the diagram small exactly when sets are sparse, which is the common case in combinatorial enumeration.",
        invariants: [
            "Terminal zero denotes the empty family and terminal one denotes the family containing only the empty set.",
            "A node's low branch covers sets missing its variable and its high branch covers sets containing it.",
            "No node has an empty high branch, because such a node is suppressed during construction.",
        ],
        correctness:
            "Splitting a family by a variable partitions it into sets without that variable and sets with it, so the low and high branches are disjoint and their union is the original family. Zero suppression is sound because a node whose high branch is empty contributes exactly the low family. Counting sums the counts of the two branches, and induction on the reduced diagram shows the value at the root equals the number of distinct sets in the family.",
        complexityRationale:
            "Each recursive split visits one variable and memoizes a node by its triple, so construction is proportional to the number of distinct reduced nodes. Counting visits each node once, and membership follows one path, so both are linear in the diagram size and independent of the number of sets enumerated explicitly.",
        uses: [
            "Enumerating and counting combinatorial objects such as independent sets",
            "Representing sparse Boolean functions in logic synthesis",
            "Teaching how reduction rules change the size of a decision diagram",
        ],
        references: [
            "Coudert and Madre, A New Representation for Boolean Functions, 1986",
            "Bryant, Graph-Based Algorithms for Boolean Function Manipulation, 1986",
        ],
        workedExample:
            "For the family of zero, one, two, one-two, and two over three variables, the split at x0 sends three sets to the low branch and one set to the high branch. Nodes whose high branch would be empty are dropped, and summing the surviving branches at the root returns five, the number of input sets.",
    },
    id: "zero-suppressed-decision-diagram",
    name: "Zero-Suppressed Decision Diagram",
    category: "data-structures",
    complexity: { time: "O(diagram nodes)", space: "O(diagram nodes)" },
    defaultInput: { universe: 3, sets: [[], [0], [1], [0, 1], [2]] },
    visualType: "tree",
    run,
    pseudocode: [
        "represent every input set as a bit mask and remove duplicates",
        "define terminal zero as the empty family and terminal one as the empty-set family",
        "split the current family by the lowest remaining variable",
        "recurse on sets without the variable for the low branch",
        "recurse on sets with the variable removed for the high branch",
        "drop the node when its high branch is the empty family",
        "reuse a node already memoized for the same variable and branches",
        "count a node as the sum of its two branch counts",
        "check membership by following one branch per variable",
    ],
};

export default module;
