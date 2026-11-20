/**
 * left-child-right-sibling-tree.ts - Left-Child Right-Sibling Encoding
 *
 * Any rooted tree with unbounded degree can be stored in a binary tree: the
 * left pointer of a node points to its first child, and the right pointer of a
 * child points to its next sibling. The binary preorder of the encoded tree is
 * exactly the preorder of the original tree, and every parent-child link is
 * preserved. The conversion is in-place in two integer arrays.
 *
 * Time:  O(n) for n nodes
 * Space: O(n) for the child lists plus the two pointer arrays
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface DrawEdge {
    id: string;
    source: number;
    target: number;
    label: string;
}

function childrenOf(parents: number[]): number[][] {
    const children: number[][] = parents.map(() => []);
    for (let i = 0; i < parents.length; i += 1) {
        const parent = parents[i] ?? -1;
        if (parent >= 0 && parent < parents.length) {
            children[parent]?.push(i);
        }
    }
    return children;
}

/** Encode a parent array as left-child and right-sibling pointer arrays. */
export function encodeLcrs(parents: number[]): { left: number[]; right: number[] } {
    const children = childrenOf(parents);
    const left = parents.map(() => -1);
    const right = parents.map(() => -1);
    for (let parent = 0; parent < parents.length; parent += 1) {
        const kids = children[parent] ?? [];
        if (kids.length === 0) {
            continue;
        }
        left[parent] = kids[0] ?? -1;
        for (let i = 0; i + 1 < kids.length; i += 1) {
            right[kids[i] ?? 0] = kids[i + 1] ?? -1;
        }
    }
    return { left, right };
}

/** Binary preorder of the encoded tree, starting at a given node. */
export function lcrsPreorder(left: number[], right: number[], root: number): number[] {
    const result: number[] = [];
    const visit = (node: number): void => {
        if (node < 0) {
            return;
        }
        result.push(node);
        visit(left[node] ?? -1);
        visit(right[node] ?? -1);
    };
    visit(root);
    return result;
}

function makeEntities(
    parents: number[],
    edges: DrawEdge[],
    highlighted: string,
    phase: number,
): { entities: VisualEntity[]; edgeEntities: VisualEdge[] } {
    const activeTargets = new Set(edges.filter((edge) => edge.id === highlighted).map((edge) => edge.target));
    const entities = parents.map((parent, index) => {
        const state: EntityState =
            phase >= 2 ? "sorted" : activeTargets.has(index) ? "active" : index === 0 ? "path" : "idle";
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: String(index),
            value: index,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, parentId: parent >= 0 ? `node-${parent}` : "root", depth: 0 },
        };
    });
    const edgeEntities = edges.map((edge) => ({
        id: edge.id,
        sourceId: `node-${edge.source}`,
        targetId: `node-${edge.target}`,
        label: edge.label,
        state: (edge.id === highlighted ? "active" : phase >= 2 ? "sorted" : "visited") as EntityState,
        directed: true,
    }));
    return { entities, edgeEntities };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { parents?: number[] } | null) ?? {};
    const rawParents = Array.isArray(task.parents) && task.parents.length > 0
        ? task.parents.map((value) => Math.trunc(value))
        : [-1, 0, 0, 0, 1, 1, 2];
    const parents = rawParents.map((parent, i) => (parent >= 0 && parent < rawParents.length && parent !== i ? parent : -1));
    const children = childrenOf(parents);
    const encoded = encodeLcrs(parents);

    let step = 0;
    const childEdges: DrawEdge[] = [];
    for (let parent = 0; parent < parents.length; parent += 1) {
        for (const kid of children[parent] ?? []) {
            childEdges.push({ id: `child-${parent}-${kid}`, source: parent, target: kid, label: "child" });
        }
    }
    yield {
        stepNumber: step,
        entities: makeEntities(parents, childEdges, "", 0).entities,
        edges: makeEntities(parents, childEdges, "", 0).edgeEntities,
        description: `Original tree of ${parents.length} nodes with unbounded child counts.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { count: parents.length, phase: "original", left: [] as number[], right: [] as number[] },
    };
    step += 1;

    const leftDone = new Set<number>();
    const rightDone = new Set<number>();
    const drawEdges = (): DrawEdge[] => {
        const result: DrawEdge[] = [];
        for (const parent of leftDone) {
            const kid = encoded.left[parent] ?? -1;
            if (kid >= 0) {
                result.push({ id: `left-${parent}-${kid}`, source: parent, target: kid, label: "left" });
            }
        }
        for (const child of rightDone) {
            const sibling = encoded.right[child] ?? -1;
            if (sibling >= 0) {
                result.push({ id: `sibling-${child}-${sibling}`, source: child, target: sibling, label: "sibling" });
            }
        }
        return result;
    };

    for (let parent = 0; parent < parents.length; parent += 1) {
        const kids = children[parent] ?? [];
        if (kids.length === 0) {
            continue;
        }
        leftDone.add(parent);
        const edges = drawEdges();
        const highlight = `left-${parent}-${kids[0]}`;
        const made = makeEntities(parents, edges, highlight, 1);
        yield {
            stepNumber: step,
            entities: made.entities,
            edges: made.edgeEntities,
            description: `Node ${parent}'s first child ${kids[0]} becomes its left pointer.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: {
                count: parents.length,
                phase: "left",
                parent,
                child: kids[0] ?? -1,
                left: [] as number[],
                right: [] as number[],
            },
        };
        step += 1;

        for (let i = 0; i + 1 < kids.length; i += 1) {
            rightDone.add(kids[i] ?? 0);
            const sibEdges = drawEdges();
            const sibHighlight = `sibling-${kids[i]}-${kids[i + 1]}`;
            const madeSib = makeEntities(parents, sibEdges, sibHighlight, 1);
            yield {
                stepNumber: step,
                entities: madeSib.entities,
                edges: madeSib.edgeEntities,
                description: `Child ${kids[i]}'s right pointer now reaches its next sibling ${kids[i + 1]}.`,
                codeLineNumber: 3,
                layout: "tree",
                meta: {
                    count: parents.length,
                    phase: "sibling",
                    parent,
                    child: kids[i] ?? -1,
                    sibling: kids[i + 1] ?? -1,
                    left: [] as number[],
                    right: [] as number[],
                },
            };
            step += 1;
        }
    }

    const roots = parents.map((parent, i) => (parent < 0 ? i : -1)).filter((i) => i >= 0);
    const originalPreorder: number[] = [];
    const walk = (node: number): void => {
        originalPreorder.push(node);
        for (const kid of children[node] ?? []) {
            walk(kid);
        }
    };
    for (const root of roots) {
        walk(root);
    }
    const encodedPreorder = roots.flatMap((root) => lcrsPreorder(encoded.left, encoded.right, root));

    const finalEdges = drawEdges();
    const madeFinal = makeEntities(parents, finalEdges, "", 2);
    yield {
        stepNumber: step,
        entities: madeFinal.entities,
        edges: madeFinal.edgeEntities,
        description:
            `Encoding complete: ${encodedPreorder.join(", ")} is the preorder, matching the original tree.`,
        codeLineNumber: 5,
        layout: "tree",
        meta: {
            count: parents.length,
            phase: "done",
            left: encoded.left,
            right: encoded.right,
            originalPreorder,
            encodedPreorder,
            samePreorder: originalPreorder.join(",") === encodedPreorder.join(","),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A tree node can have any number of children, but a binary tree node has only two pointers. The left-child right-sibling encoding uses the left pointer for the first child and chains the remaining children through right pointers. Doing this for every node turns an arbitrary tree into a binary tree without allocating new nodes.",
        invariants: [
            "left of a node is its first child or minus one when it has no children.",
            "right of a child is the next sibling in the same child list or minus one for the last child.",
            "Following right pointers from any first child visits exactly that parent's children in order.",
        ],
        correctness:
            "Every parent-child pair is represented by exactly one left pointer, because the encoding iterates each parent's child list once. Consecutive children are linked by right pointers in list order, so the sibling chain enumerates all and only the children. A binary preorder visits a node, its left subtree, and then its right subtree; in this encoding that is the node, its first child with that child's siblings, and their descendants, which is exactly the original preorder.",
        complexityRationale:
            "Building the child lists scans all n parent entries once, and linking left and right pointers visits each entry once more, so conversion is O(n). The child lists and two pointer arrays take O(n) space beyond the input.",
        uses: [
            "Representing syntax trees and expression trees with fixed-size nodes",
            "Converting n-ary heaps and tries into binary structures",
            "Teaching the relationship between general trees and binary trees",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 1: Fundamental Algorithms, Section 2.3",
            "CLRS, Introduction to Algorithms, Chapter 10: Elementary Data Structures",
        ],
        workedExample:
            "For parents minus one, zero, zero, zero, one, one, two, node zero has children one, two, three. Its left pointer becomes one, and the right pointers chain one to two to three. A binary preorder from node zero visits zero, one, four, five, two, six, three, which matches the original tree preorder.",
    },
    id: "left-child-right-sibling-tree",
    name: "Left-Child Right-Sibling Tree",
    category: "data-structures",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { parents: [-1, 0, 0, 0, 1, 1, 2] },
    visualType: "tree",
    run,
    pseudocode: [
        "build a child list for every node from the parent array",
        "initialize left and right pointers to minus one",
        "for each parent take its child list in input order",
        "set the parent's left pointer to the first child",
        "set each earlier child's right pointer to the following child",
        "leave the last child's right pointer as minus one",
        "walk the encoded tree in binary preorder from each root",
        "compare that walk with the original tree preorder",
    ],
};

export default module;
