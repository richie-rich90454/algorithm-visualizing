/**
 * tree-isomorphism-unrooted.ts - Unrooted Tree Isomorphism (AHU center canonical form)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two free (unrooted) trees are isomorphic exactly when they have the same
 * shape after ignoring vertex names. The AHU method roots each tree at one of
 * its centers, encodes every node as a parenthesized, sorted list of its
 * children's codes, and compares the resulting strings. A tree has one or two
 * centers, found by repeatedly stripping leaves, so we take the minimum of the
 * one or two canonical forms to be independent of the chosen root.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for the leaf queue plus sorting child codes
 *   Space: O(n) for the parent map and canonical strings
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Both trees are drawn side by side in the tree layout.
 *   - Leaves being stripped are YELLOW (comparing); removed nodes are visited.
 *   - The surviving center(s) are highlighted, then each node shows its code
 *     as it is assigned in postorder.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type TreeSpec = {
    parentMap?: Record<string, string | null>;
    ids?: string[];
};

type Tree = {
    ids: string[];
    parent: Map<string, string | null>;
    children: Map<string, string[]>;
    root: string;
};

function readTree(spec: TreeSpec | undefined, prefix: string, fallback: TreeSpec): Tree {
    const source = spec ?? fallback;
    const ids = source.ids ?? Object.keys(source.parentMap ?? {});
    const parent = new Map<string, string | null>();
    for (const id of ids) {
        parent.set(id, source.parentMap?.[id] ?? null);
    }
    const children = new Map<string, string[]>();
    for (const id of ids) {
        children.set(id, []);
    }
    for (const id of ids) {
        const p = parent.get(id);
        if (p && children.has(p)) {
            children.get(p)?.push(id);
        }
    }
    const root = ids.find((id) => parent.get(id) === null) ?? ids[0] ?? `${prefix}0`;
    return { ids, parent, children, root };
}

/** Strip leaves level by level; return the one or two centers. */
function findCenters(tree: Tree): string[] {
    let alive = new Set(tree.ids);
    const rounds: string[][] = [];
    while (alive.size > 2) {
        const leaves = [...alive].filter((id) => {
            const p = tree.parent.get(id);
            const internal = (tree.children.get(id) ?? []).filter((c) => alive.has(c)).length;
            const up = p && alive.has(p) ? 1 : 0;
            return internal + up <= 1;
        });
        if (leaves.length === 0) {
            break;
        }
        rounds.push(leaves);
        for (const leaf of leaves) {
            alive.delete(leaf);
        }
    }
    return [...alive];
}

/** Canonical AHU string when the free tree is rooted at `root`. */
function canonicalAt(tree: Tree, root: string): { code: string; codes: Map<string, string> } {
    const codes = new Map<string, string>();
    const encode = (id: string): string => {
        const parts = (tree.children.get(id) ?? []).map(encode).sort();
        const code = `(${parts.join("")})`;
        codes.set(id, code);
        return code;
    };
    return { code: encode(root), codes };
}

/** The root-independent canonical form of an unrooted tree. */
function canonicalForm(tree: Tree): { best: string; centers: string[]; perCenter: string[] } {
    const centers = findCenters(tree);
    const perCenter = centers.map((c) => canonicalAt(tree, c).code);
    return { best: perCenter.slice().sort()[0] ?? "", centers, perCenter };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { treeA?: TreeSpec; treeB?: TreeSpec } | null) ?? {};
    const fallbackA: TreeSpec = {
        parentMap: { A: null, B: "A", C: "B", D: "C", E: "B" },
        ids: ["A", "B", "C", "D", "E"],
    };
    const fallbackB: TreeSpec = {
        parentMap: { P: null, Q: "P", R: "Q", S: "R", T: "Q" },
        ids: ["P", "Q", "R", "S", "T"],
    };
    const treeA = readTree(task.treeA, "a-", fallbackA);
    const treeB = readTree(task.treeB, "b-", fallbackB);

    let step = 0;
    const codeA = new Map<string, string>();
    const codeB = new Map<string, string>();

    const nodesFor = (tree: Tree, states: Map<string, EntityState>, codes: Map<string, string>): VisualEntity[] =>
        tree.ids.map((id) => ({
            id: `node-${id}`,
            type: "node" as const,
            label: codes.has(id) ? `${id}:${codes.get(id)}` : id,
            value: id,
            state: states.get(id) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: tree.parent.get(id) ?? "root" },
        }));

    const edgesFor = (tree: Tree): VisualEdge[] =>
        tree.ids
            .filter((id) => tree.parent.get(id))
            .map((id) => ({
                id: `edge-${tree.parent.get(id)}-${id}`,
                sourceId: `node-${tree.parent.get(id)}`,
                targetId: `node-${id}`,
                label: "",
                state: "idle" as EntityState,
                directed: false,
            }));

    const frame = (
        statesA: Map<string, EntityState>,
        statesB: Map<string, EntityState>,
        description: string,
        line: number,
        meta: VisualFrame["meta"],
    ): VisualFrame => ({
        stepNumber: step,
        entities: [...nodesFor(treeA, statesA, codeA), ...nodesFor(treeB, statesB, codeB)],
        edges: [...edgesFor(treeA), ...edgesFor(treeB)],
        description,
        codeLineNumber: line,
        layout: "tree",
        meta,
    });

    yield frame(
        new Map(),
        new Map(),
        `Comparing two free trees with ${treeA.ids.length} and ${treeB.ids.length} vertices.`,
        0,
        { phase: "start", verticesA: treeA.ids.length, verticesB: treeB.ids.length },
    );
    step += 1;

    // Show leaf stripping for both trees, one layer at a time.
    const layersOf = (tree: Tree): string[][] => {
        const degree = new Map<string, number>();
        for (const id of tree.ids) {
            const p = tree.parent.get(id);
            degree.set(id, (tree.children.get(id)?.length ?? 0) + (p && tree.ids.includes(p) ? 1 : 0));
        }
        let alive = new Set(tree.ids);
        const layers: string[][] = [];
        while (alive.size > 2) {
            const leaves = [...alive].filter((id) => {
                const p = tree.parent.get(id);
                const down = (tree.children.get(id) ?? []).filter((c) => alive.has(c)).length;
                const up = p && alive.has(p) ? 1 : 0;
                return down + up <= 1;
            });
            if (leaves.length === 0) {
                break;
            }
            layers.push(leaves);
            for (const leaf of leaves) {
                alive.delete(leaf);
            }
        }
        return layers;
    };

    const layersA = layersOf(treeA);
    const layersB = layersOf(treeB);
    const maxLayers = Math.max(layersA.length, layersB.length);
    for (let round = 0; round < maxLayers; round += 1) {
        const sa = new Map<string, EntityState>();
        const sb = new Map<string, EntityState>();
        for (let r = 0; r <= round; r += 1) {
            for (const id of layersA[r] ?? []) {
                sa.set(id, "visited");
            }
            for (const id of layersB[r] ?? []) {
                sb.set(id, "visited");
            }
        }
        for (const id of layersA[round] ?? []) {
            sa.set(id, "comparing");
        }
        for (const id of layersB[round] ?? []) {
            sb.set(id, "comparing");
        }
        yield frame(
            sa,
            sb,
            `Strip layer ${round + 1}: ${(layersA[round] ?? []).join(",") || "-"} and ${(layersB[round] ?? []).join(",") || "-"}.`,
            1,
            { phase: "peel", round: round + 1 },
        );
        step += 1;
    }

    const formA = canonicalForm(treeA);
    const formB = canonicalForm(treeB);
    yield frame(
        new Map(formA.centers.map((id) => [id, "highlight" as EntityState])),
        new Map(formB.centers.map((id) => [id, "highlight" as EntityState])),
        `Centers: tree A ${formA.centers.join("/")}, tree B ${formB.centers.join("/")}.`,
        2,
        { phase: "centers", centersA: formA.centers.join("/"), centersB: formB.centers.join("/") },
    );
    step += 1;

    // Postorder encoding under each center, shown node by node.
    for (const tree of [treeA, treeB]) {
        const centers = tree === treeA ? formA.centers : formB.centers;
        const targetCodes = tree === treeA ? codeA : codeB;
        for (const center of centers) {
            const { codes } = canonicalAt(tree, center);
            const order = [...codes.keys()];
            for (const id of order) {
                targetCodes.set(id, codes.get(id) ?? "");
                const sa = new Map<string, EntityState>();
                const sb = new Map<string, EntityState>();
                const states = tree === treeA ? sa : sb;
                states.set(id, "active");
                yield frame(
                    sa,
                    sb,
                    `Rooted at ${center}: encode ${id} as ${codes.get(id)}.`,
                    3,
                    {
                        phase: "encode",
                        root: center,
                        node: id,
                        code: codes.get(id) ?? "",
                    },
                );
                step += 1;
            }
        }
    }

    const isomorphic = formA.best === formB.best;
    const finalA = new Map<string, EntityState>();
    const finalB = new Map<string, EntityState>();
    for (const id of treeA.ids) {
        finalA.set(id, isomorphic ? "sorted" : "error");
    }
    for (const id of treeB.ids) {
        finalB.set(id, isomorphic ? "sorted" : "error");
    }
    yield frame(
        finalA,
        finalB,
        isomorphic
            ? `Isomorphic: both trees have canonical form ${formA.best}.`
            : `Not isomorphic: ${formA.best} versus ${formB.best}.`,
        4,
        {
            phase: "done",
            isomorphic,
            canonicalA: formA.best,
            canonicalB: formB.best,
        },
    );

    return;
}

/** The unrooted tree isomorphism module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A free tree has no chosen root, so comparing two trees directly is awkward. Find the tree's center by peeling leaves until one or two vertices remain, root there, and write each node as a pair of parentheses around the sorted codes of its children. If the final strings match, the shapes match even though the vertex names and original roots differ.",
        invariants: [
            "Peeling leaves never removes the center of a tree.",
            "A node's code depends only on the multiset of its children's codes.",
            "A tree has exactly one or two centers, so taking the minimum code removes root ambiguity.",
        ],
        correctness:
            "Rooted trees have equal AHU codes if and only if they are isomorphic: by induction on height, equal codes mean equal multisets of child codes, which by induction correspond to isomorphic child subtrees. Two free trees are isomorphic exactly when some rooting of one matches some rooting of the other, and any isomorphism maps centers to centers, so comparing the minimum code over the one or two centers is both necessary and sufficient.",
        complexityRationale:
            "The leaf queue processes each vertex once, O(n). Recursive encoding touches every node, and sorting child codes at a node with d children costs O(d log d), so the total is O(n log n); storing the parent map and codes uses O(n) space.",
        uses: [
            "Chemical molecule shape comparison where atoms are unlabeled nodes",
            "Detecting duplicate phylogenetic tree topologies",
            "Canonicalizing parse trees before caching compiler results",
        ],
        references: [
            "Aho, Hopcroft and Ullman, Data Structures and Algorithms, Section on tree isomorphism",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, Chapter 12",
            "Harary and Palmer, Graphical Enumeration, 1973",
        ],
        workedExample:
            "A path of four vertices has one center pair in the middle; rooting at either middle vertex yields ((( ))) style codes that match a relabeled copy of the same path. A star with four leaves roots at its hub and produces a code with four empty child codes, which never equals the path code, so the two are reported as not isomorphic.",
    },
    id: "tree-isomorphism-unrooted",
    name: "Unrooted Tree Isomorphism",
    category: "tree",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        treeA: {
            ids: ["A", "B", "C", "D", "E"],
            parentMap: { A: null, B: "A", C: "B", D: "C", E: "B" },
        },
        treeB: {
            ids: ["P", "Q", "R", "S", "T"],
            parentMap: { P: null, Q: "P", R: "Q", S: "R", T: "Q" },
        },
    },
    visualType: "tree",
    run,
    pseudocode: [
        "compute the degree of every vertex",
        "repeat: collect current leaves and delete them until one or two vertices remain",
        "the remaining vertices are the tree centers",
        "for each center, encode nodes in postorder as parenthesized sorted child codes",
        "take the smallest code over all centers as the canonical form",
        "compare the canonical forms of the two trees",
        "done: equal forms mean the free trees are isomorphic",
    ],
};

export default module;
