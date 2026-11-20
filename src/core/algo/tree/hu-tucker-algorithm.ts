/**
 * hu-tucker-algorithm.ts - Hu-Tucker Optimal Alphabetic Tree
 *
 * Phase one repeatedly merges the lightest compatible pair in a working
 * sequence. Phase two reads the leaf levels of that tree, and phase three
 * recombines adjacent leaves of equal maximum level into an order-preserving
 * tree with the same optimal cost.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

type Task = { weights?: number[] };
type HNode = {
    id: string;
    weight: number;
    position: number;
    kind: "terminal" | "internal";
    left?: HNode;
    right?: HNode;
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const weights = (Array.isArray(task.weights) ? task.weights : [4, 3, 2, 6, 5])
        .map((w) => Math.max(0, Math.floor(w)));
    const n = weights.length;
    const frames: VisualFrame[] = [];
    let step = 0;
    let merges = 0;

    const emitList = (
        values: number[],
        description: string,
        line: number,
        hot: number[] = [],
        layout: "grid" | "tree" = "grid",
        extra: Record<string, number | string | boolean> = {},
    ): void => {
        frames.push({
            stepNumber: step,
            entities: values.map((value, i) => ({
                id: `cell-${i}`,
                type: "cell",
                label: String(value),
                value,
                state: hot.includes(i) ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: i },
            })),
            edges: [],
            description,
            codeLineNumber: line,
            layout,
            meta: { leaves: n, merges, items: values.length, ...extra },
        });
        step += 1;
    };

    if (n === 0) {
        emitList([], "No weights - no alphabetic tree exists.", 0, [], "grid", { optimalCost: 0 });
        yield* frames;
        return;
    }
    if (n === 1) {
        emitList([0], "A single leaf sits at level zero with cost zero.", 0, [], "tree", { optimalCost: 0 });
        yield* frames;
        return;
    }

    let seq: HNode[] = weights.map((w, i) => ({ id: `leaf-${i}`, weight: w, position: i, kind: "terminal" }));
    const originalLeaves = [...seq];
    emitList(seq.map((node) => node.weight), `Hu-Tucker phase one on weights ${weights.join(", ")}.`, 0);

    let start = 0;
    let end = n - 1;
    const findMinimum = (): number => {
        let best = start;
        for (let i = start + 1; i <= end; i += 1) {
            if ((seq[i]?.weight ?? Infinity) < (seq[best]?.weight ?? Infinity)) {
                best = i;
            }
        }
        return best;
    };
    const findCompatible = (node: number): number => {
        let minLeft = node;
        let minRight = node;
        if (node !== start) {
            minLeft = node - 1;
            for (let left = node - 2; left >= start && seq[left + 1]?.kind !== "terminal"; left -= 1) {
                if ((seq[minLeft]?.weight ?? 0) >= (seq[left]?.weight ?? 0)) {
                    minLeft = left;
                }
            }
        }
        if (node !== end) {
            minRight = node + 1;
            for (let right = node + 2; right <= end && seq[right - 1]?.kind !== "terminal"; right += 1) {
                if ((seq[minRight]?.weight ?? 0) > (seq[right]?.weight ?? 0)) {
                    minRight = right;
                }
            }
        }
        if (minLeft === node) {
            return minRight;
        }
        if (minRight === node) {
            return minLeft;
        }
        return (seq[minLeft]?.weight ?? 0) <= (seq[minRight]?.weight ?? 0) ? minLeft : minRight;
    };

    let guard = 0;
    while (start < end && guard < n * n + 10) {
        guard += 1;
        const pmin = findMinimum();
        const pcom = findCompatible(pmin);
        const left = seq[Math.min(pmin, pcom)] as HNode;
        const right = seq[Math.max(pmin, pcom)] as HNode;
        merges += 1;
        const merged: HNode = {
            id: `merge-${merges}`,
            weight: left.weight + right.weight,
            position: Math.min(left.position, right.position),
            kind: "internal",
            left,
            right,
        };
        const insertAt = Math.min(pmin, pcom);
        const removeAt = Math.max(pmin, pcom);
        seq = [...seq.slice(0, insertAt), merged, ...seq.slice(insertAt + 1, removeAt), ...seq.slice(removeAt + 1)];
        end -= 1;
        emitList(
            seq.map((item) => item.weight),
            `Combined weights ${left.weight} and ${right.weight} into ${merged.weight}; ${end - start + 1} node(s) remain.`,
            2,
            [insertAt],
        );
    }
    const root = seq[start];
    if (!root) {
        emitList([], "Phase one produced no root.", 3);
        yield* frames;
        return;
    }

    const levels = new Array<number>(n).fill(0);
    const assign = (node: HNode, level: number): void => {
        if (node.kind === "terminal") {
            levels[node.position] = level;
            return;
        }
        if (node.left) {
            assign(node.left, level + 1);
        }
        if (node.right) {
            assign(node.right, level + 1);
        }
    };
    assign(root, 0);
    emitList(levels, `Phase two leaf levels: ${levels.join(", ")}.`, 4);

    let nodeId = 0;
    const combined: HNode[] = originalLeaves.map((leaf) => ({ ...leaf, id: leaf.id }));
    const recombine = (a: HNode, b: HNode): HNode => {
        nodeId += 1;
        return {
            id: `join-${nodeId}`,
            weight: a.weight + b.weight,
            position: a.position,
            kind: "internal",
            left: a,
            right: b,
        };
    };
    const workLevels = [...levels];
    const stack: number[] = [0];
    let cont = 1;
    while (cont < n) {
        stack.push(cont);
        cont += 1;
        while (stack.length > 1 && workLevels[stack[stack.length - 1] as number] === workLevels[stack[stack.length - 2] as number]) {
            const rightIndex = stack.pop() as number;
            const leftIndex = stack.pop() as number;
            const left = combined[leftIndex];
            const right = combined[rightIndex];
            if (!left || !right) {
                break;
            }
            combined[leftIndex] = recombine(left, right);
            combined[rightIndex] = { ...right, weight: 0 };
            workLevels[leftIndex] = (workLevels[leftIndex] ?? 0) - 1;
            stack.push(leftIndex);
            if (stack.length > 1) {
                emitList(workLevels.slice(0, n), `Recombination joined leaves at level ${(workLevels[leftIndex] ?? 0) + 1}.`, 6, [leftIndex]);
            }
        }
    }
    const finalRoot = combined[stack[0] ?? 0] ?? root;

    const parentMap = new Map<string, string | null>();
    const ids: string[] = [];
    const collect = (node: HNode, parent: string | null): void => {
        ids.push(node.id);
        parentMap.set(node.id, parent);
        if (node.left) {
            collect(node.left, node.id);
        }
        if (node.right && node.right.kind === "internal") {
            collect(node.right, node.id);
        } else if (node.right) {
            ids.push(node.right.id);
            parentMap.set(node.right.id, node.id);
        }
    };
    collect(finalRoot, null);

    let cost = 0;
    for (let i = 0; i < n; i += 1) {
        cost += (weights[i] ?? 0) * (levels[i] ?? 0);
    }
    frames.push({
        stepNumber: step,
        entities: makeTreeNodes(parentMap, ids).map((node) => {
            const leafIndex = node.id.startsWith("leaf-") ? Number(node.id.slice(5)) : -1;
            return {
                ...node,
                label: leafIndex >= 0 ? `w=${weights[leafIndex]}` : "join",
                value: leafIndex >= 0 ? (weights[leafIndex] ?? 0) : 0,
                state: leafIndex >= 0 ? "sorted" : "visited",
            };
        }),
        edges: makeTreeEdges(parentMap, ids),
        description: `Hu-Tucker tree preserves leaf order with weighted path cost ${cost}.`,
        codeLineNumber: 7,
        layout: "tree",
        meta: { leaves: n, merges, optimalCost: cost, levels },
    });
    step += 1;
    yield* frames;
}

const module: AlgorithmModule = {
    id: "hu-tucker-algorithm",
    name: "Hu-Tucker Algorithm",
    category: "tree",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { weights: [4, 3, 2, 6, 5] },
    visualType: "tree",
    run,
    pseudocode: [
        "start with a working sequence of terminal leaves",
        "find the lightest node and its lightest compatible partner",
        "merge them into an internal node and remove the partner",
        "repeat until one working node remains",
        "read the depth level of every leaf in the merged tree",
        "scan leaves and join adjacent equal maximum levels",
        "continue joining until one level-zero node remains",
        "report the order-preserving tree and its cost",
    ],
    education: {
        intuition:
            "Hu-Tucker builds an optimal alphabetic tree without ever sorting the leaves. It repeatedly joins two compatible nodes with the smallest combined weight; compatibility means no terminal separates them. The leaf levels of that tree are then used to rebuild the same shape with leaves in their original order.",
        invariants: [
            "Only nodes within the same stretch of nonterminal entries can be merged.",
            "Each merge raises no existing leaf level and creates one internal node.",
            "Adjacent leaves with equal maximum level can always be paired during recombination.",
        ],
        correctness:
            "Hu and Tucker proved that merging a lightest compatible pair preserves the existence of an optimal alphabetic tree. The resulting leaf levels therefore have minimum weighted path length. Rebuilding from those levels by repeatedly joining adjacent deepest leaves is the unique order-preserving tree with those depths, so it has the same minimum cost.",
        complexityRationale:
            "A direct scan finds a compatible pair in O(n) per merge, giving O(n^2); with priority queues and union-find the standard implementation is O(n log n). The working sequence and tree nodes use O(n) space.",
        uses: [
            "Optimal alphabetic coding and text compression",
            "Constructing optimal search trees with ordered keys",
            "A classical alternative to Garsia-Wachs",
        ],
        references: [
            "Hu and Tucker, Optimal Computer Search Trees and Variable-Length Alphabetic Codes, SIAM Journal on Applied Mathematics 1971",
            "Knuth, The Art of Computer Programming, Volume 3, section 6.2.2",
        ],
        workedExample:
            "For weights 4, 3, 2, 6, 5 the lightest compatible merges combine 3 with 2 and then 4 with the new node. Reading leaf levels from that tree and recombining equal deepest levels yields an alphabetic tree whose weighted path cost matches the interval DP optimum.",
    },
};

export default module;
