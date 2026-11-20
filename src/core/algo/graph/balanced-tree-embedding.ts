/**
 * balanced-tree-embedding.ts - Tidy Tree Embedding (Reingold-Tilford)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This algorithm assigns horizontal coordinates to the nodes of a rooted tree
 * so that no two nodes at the same depth overlap, siblings keep their input
 * order, and each parent sits centered over its children. It works bottom up:
 * each subtree reports the left and right outline of the drawing it produces,
 * and a sibling is slid to the right until its outline clears the outlines
 * already placed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^2) in this reference implementation (subtree sliding)
 *   Space: O(V^2) for the stored outlines and subtree node lists
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are placed at their computed (x, depth) coordinates.
 *   - A node turns GREEN as its final coordinate is fixed in post-order.
 *   - Parent-to-child edges are CYAN in the finished embedding.
 */

import type { AlgorithmModule, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type EdgePair = [string, string];
type Meta = Record<string, number | string | boolean | Array<number | string>>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { edges?: EdgePair[]; root?: string } | null) ?? {};
    const edges: EdgePair[] = task.edges ?? [
        ["A", "B"],
        ["A", "C"],
        ["B", "D"],
        ["B", "E"],
        ["C", "F"],
        ["C", "G"],
        ["E", "H"],
        ["E", "I"],
        ["G", "J"],
    ];
    const root = task.root ?? "A";
    const children = new Map<string, string[]>();
    const vertices = new Set<string>([root]);
    for (const [p, c] of edges) {
        vertices.add(p);
        vertices.add(c);
        const list = children.get(p) ?? [];
        list.push(c);
        children.set(p, list);
    }
    const labels = [...vertices].sort();

    let step = 0;
    const frame = (
        description: string,
        line: number,
        x: Map<string, number>,
        depth: Map<string, number>,
        done: Set<string>,
        showEdges: boolean,
        meta: Meta,
    ): VisualFrame => {
        const nodes = makeGraphNodes(labels).map((n) => {
            const v = String(n.value);
            n.x = x.get(v) ?? 0;
            n.y = depth.get(v) ?? 0;
            n.metadata["depth"] = depth.get(v) ?? 0;
            n.metadata["x"] = n.x;
            n.state = done.has(v) ? "sorted" : "unvisited";
            return n;
        });
        const visualEdges = showEdges
            ? edges.map(([p, c], i) => ({
                  id: `edge-${i}-${p}-${c}`,
                  sourceId: `node-${p}`,
                  targetId: `node-${c}`,
                  label: "",
                  state: "path" as const,
                  directed: true,
              }))
            : [];
        return {
            stepNumber: step,
            entities: nodes,
            edges: visualEdges,
            description,
            codeLineNumber: line,
            layout: "point" as const,
            meta,
        };
    };

    const x = new Map<string, number>();
    const depth = new Map<string, number>([[root, 0]]);
    const done = new Set<string>();
    if (labels.length === 0) {
        yield frame("Empty tree - nothing to embed.", 0, x, depth, done, false, { nodes: 0 });
        return;
    }

    yield frame(
        `Embedding a ${labels.length}-node tree rooted at ${root} with tidy outlines.`,
        0,
        x,
        depth,
        done,
        false,
        { nodes: labels.length, maxDepth: 0 },
    );
    step += 1;

    interface Info {
        left: number[];
        right: number[];
        subtree: string[];
    }
    const finished: VisualFrame[] = [];
    const build = (v: string): Info => {
        const kids = children.get(v) ?? [];
        if (kids.length === 0) {
            x.set(v, 0);
            done.add(v);
            finished.push(
                frame(`Leaf ${v} fixes its coordinate at 0.`, 2, x, depth, done, false, {
                    nodes: labels.length,
                    placed: done.size,
                }),
            );
            step += 1;
            return { left: [0], right: [0], subtree: [v] };
        }
        const infos = kids.map(build);
        const placedRight: number[] = [];
        const offsets: number[] = [];
        for (const info of infos) {
            let shift = 0;
            const upto = Math.min(placedRight.length, info.left.length);
            for (let d = 0; d < upto; d += 1)
                shift = Math.max(shift, (placedRight[d] as number) - (info.left[d] as number) + 1);
            offsets.push(shift);
            for (const id of info.subtree) x.set(id, (x.get(id) as number) + shift);
            for (let d = 0; d < info.right.length; d += 1) {
                const candidate = shift + (info.right[d] as number);
                placedRight[d] = Math.max(placedRight[d] ?? -Infinity, candidate);
            }
        }
        const first = x.get(kids[0] as string) as number;
        const last = x.get(kids[kids.length - 1] as string) as number;
        x.set(v, (first + last) / 2);
        const maxDepth = 1 + Math.max(...infos.map((i) => i.left.length));
        const left: number[] = [x.get(v) as number];
        const right: number[] = [x.get(v) as number];
        for (let d = 1; d < maxDepth; d += 1) {
            let lo = Infinity;
            let hi = -Infinity;
            for (let i = 0; i < infos.length; i += 1) {
                const info = infos[i] as Info;
                const shift = offsets[i] as number;
                if (d - 1 < info.left.length) lo = Math.min(lo, shift + (info.left[d - 1] as number));
                if (d - 1 < info.right.length) hi = Math.max(hi, shift + (info.right[d - 1] as number));
            }
            left.push(lo);
            right.push(hi);
        }
        done.add(v);
        finished.push(
            frame(
                `Node ${v} centered at ${x.get(v)} after sliding ${kids.length} child subtree(s).`,
                6,
                x,
                depth,
                done,
                false,
                { nodes: labels.length, placed: done.size },
            ),
        );
        step += 1;
        return { left, right, subtree: [v, ...infos.flatMap((i) => i.subtree)] };
    };

    build(root);
    const queue = [root];
    while (queue.length > 0) {
        const u = queue.shift() as string;
        for (const c of children.get(u) ?? []) {
            depth.set(c, (depth.get(u) as number) + 1);
            queue.push(c);
        }
    }

    for (const f of finished) yield f;

    const minX = Math.min(...labels.map((v) => x.get(v) ?? 0));
    for (const v of labels) x.set(v, (x.get(v) ?? 0) - minX);
    const maxDepth = Math.max(...labels.map((v) => depth.get(v) ?? 0));
    const positions = labels.map((v) => `${v}:${x.get(v)}@${depth.get(v)}`).join("|");
    yield frame(
        `Tidy embedding complete: ${labels.length} node(s) over ${maxDepth + 1} depth level(s) without overlap.`,
        8,
        x,
        depth,
        done,
        true,
        { nodes: labels.length, maxDepth: maxDepth + 1, positions },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Lay out each subtree as a small tidy drawing, then glue sibling drawings together. To glue two of them, slide the right one just far enough that its outline at every depth clears the outline already placed. Finally put the parent above the middle of its children. Because the outlines never intersect, nodes on the same level never collide.",
        invariants: [
            "The outline arrays record the extreme left and right coordinate at every relative depth of a subtree.",
            "A sibling is shifted by the smallest amount that separates its left outline from every placed right outline.",
            "Siblings appear left to right in their input order.",
        ],
        correctness:
            "By induction a leaf drawing has no overlaps and a one-entry outline. When subtrees are combined, the computed shift makes the new subtree's leftmost coordinate at each depth strictly greater than every earlier subtree's rightmost coordinate at that depth, so no two nodes from different subtrees share a position. Shifting preserves each subtree's internal layout, and placing the parent between its outermost child roots keeps it clear of lower levels. Thus the whole drawing is overlap-free and preserves sibling order.",
        complexityRationale:
            "Each internal node stores an outline proportional to its height and slides every descendant when a sibling is offset, which in the worst case is O(V^2) time and O(V^2) stored outline entries on a chain-like tree; the space is O(V + E) for the tree itself.",
        uses: [
            "Drawing organizational charts and file trees without overlaps",
            "Laying out expression trees in compilers and debuggers",
            "Rendering phylogenetic trees in bioinformatics tools",
        ],
        references: [
            "Reingold and Tilford, Tidying Drawings of Rooted Trees, 1981",
            "Wetherell and Shannon, Tidy Drawings of Trees, 1979",
        ],
        workedExample:
            "A root with two leaf children places the first leaf at x 0. The second leaf would also start at 0, so it slides to x 1 to clear the outline. The root is then centered at 0.5, giving three distinct coordinates at their depths and the children in input order.",
    },
    id: "balanced-tree-embedding",
    name: "Tidy Tree Embedding (Reingold-Tilford)",
    category: "graph",
    complexity: { time: "O(V^2)", space: "O(V^2)" },
    defaultInput: {
        edges: [
            ["A", "B"],
            ["A", "C"],
            ["B", "D"],
            ["B", "E"],
            ["C", "F"],
            ["C", "G"],
            ["E", "H"],
            ["E", "I"],
            ["G", "J"],
        ],
        root: "A",
    },
    visualType: "point",
    run,
    pseudocode: [
        "build the child lists from the parent-child edge pairs",
        "visit nodes in post-order so children are laid out first",
        "give a leaf a single outline entry at coordinate zero",
        "for each child subtree compute the shift that clears placed outlines",
        "add the shift to every coordinate inside that subtree",
        "merge child outlines into the parent's left and right outline",
        "place the parent at the middle of its outermost children",
        "compute depths from the root and shift all coordinates to start at zero",
        "done: emit the overlap-free tidy embedding",
    ],
};

export default module;
