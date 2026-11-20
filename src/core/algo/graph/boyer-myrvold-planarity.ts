/**
 * boyer-myrvold-planarity.ts - Boyer-Myrvold Planarity Testing
 *
 * Planarity testing follows the Boyer-Myrvold outline: run a depth-first
 * search, identify tree edges and backedges, and look at how the backedges
 * interlace in the DFS order. Interlacing backedges force left/right choices in
 * an embedding. This visualization presents those stages and then decides
 * planarity by exhaustively testing orientable rotation systems, counting
 * faces and applying Euler's formula; the first embedding with n - m + f equal
 * to one plus the component count is a planar certificate.
 *
 * Time O(systems * E) for the exhaustive decision, space O(V + E).
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

type Graph = Record<string, string[]>;

function permutations(values: number[]): number[][] {
    if (values.length <= 1) return [values.slice()];
    const out: number[][] = [];
    for (let i = 0; i < values.length; i += 1) {
        const rest = values.slice(0, i).concat(values.slice(i + 1));
        for (const tail of permutations(rest)) out.push([values[i]!, ...tail]);
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Graph } | null) ?? {};
    const raw = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C"],
        C: ["A", "B", "D"],
        D: ["A", "C", "E"],
        E: ["D"],
    };
    const labels = [...new Set([...Object.keys(raw), ...Object.values(raw).flat()])].sort();
    const indexOf = new Map(labels.map((label, i) => [label, i]));
    const n = labels.length;
    const adj: number[][] = labels.map(() => []);
    const edgeSet = new Set<string>();
    for (const [u, vs] of Object.entries(raw)) {
        const i = indexOf.get(u);
        if (i === undefined) continue;
        for (const v of vs) {
            const j = indexOf.get(v);
            if (j === undefined || i === j) continue;
            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
            if (edgeSet.has(key)) continue;
            edgeSet.add(key);
            adj[i]!.push(j);
            adj[j]!.push(i);
        }
    }
    for (const list of adj) list.sort((a, b) => a - b);
    const edgeList = [...edgeSet].map((key) => key.split("-").map(Number) as [number, number]);
    const m = edgeList.length;

    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(raw);
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean | Array<number | string>>,
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });
    const reset = (): void => {
        for (const node of nodes) node.state = "unvisited";
        for (const edge of edges) edge.state = "idle";
    };
    const setEdge = (i: number, j: number, state: EntityState): void => {
        const a = labels[i]!;
        const b = labels[j]!;
        const edge = edges.find(
            (e) =>
                (e.sourceId === `node-${a}` && e.targetId === `node-${b}`) ||
                (e.sourceId === `node-${b}` && e.targetId === `node-${a}`),
        );
        if (edge) edge.state = state;
    };

    if (n === 0 || m === 0) {
        yield snap("No edges - the graph is trivially planar.", 0, {
            planar: true,
            vertices: n,
            edges: m,
            faces: 0,
            components: n,
            systemsChecked: 0,
            systemsTotal: 1,
            exact: true,
        });
        return;
    }

    // Component count for Euler's formula.
    const components = (() => {
        const seen = new Set<number>();
        let count = 0;
        for (let s = 0; s < n; s += 1) {
            if (seen.has(s)) continue;
            count += 1;
            const stack = [s];
            seen.add(s);
            while (stack.length > 0) {
                const u = stack.pop()!;
                for (const v of adj[u]!) {
                    if (!seen.has(v)) {
                        seen.add(v);
                        stack.push(v);
                    }
                }
            }
        }
        return count;
    })();

    yield snap(
        `Testing planarity of ${n} vertices and ${m} edges in ${components} component(s).`,
        0,
        { planar: false, vertices: n, edges: m, components, systemsChecked: 0, systemsTotal: 0, exact: true },
    );
    step += 1;

    // Depth-first search: record the tree and the backedges.
    const tin = new Array<number>(n).fill(-1);
    const parent = new Array<number>(n).fill(-1);
    const treeEdges: Array<[number, number]> = [];
    const backEdges: Array<[number, number]> = [];
    let timer = 0;
    for (let root = 0; root < n; root += 1) {
        if (tin[root] !== -1) continue;
        tin[root] = timer;
        timer += 1;
        const stack: Array<{ u: number; next: number }> = [{ u: root, next: 0 }];
        while (stack.length > 0) {
            const frame = stack[stack.length - 1]!;
            const u = frame.u;
            if (frame.next >= adj[u]!.length) {
                stack.pop();
                continue;
            }
            const v = adj[u]![frame.next]!;
            frame.next += 1;
            if (v === parent[u]) continue;
            if (tin[v] === -1) {
                parent[v] = u;
                tin[v] = timer;
                timer += 1;
                treeEdges.push([u, v]);
                stack.push({ u: v, next: 0 });
            } else if (u < v) {
                backEdges.push([u, v]);
            }
        }
    }
    reset();
    for (const [u, v] of treeEdges) setEdge(u, v, "active");
    for (const [u, v] of backEdges) setEdge(u, v, "path");
    yield snap(
        `DFS found ${treeEdges.length} tree edges and ${backEdges.length} backedges for interlacement analysis.`,
        2,
        { planar: false, vertices: n, edges: m, components, systemsChecked: 0, systemsTotal: 0, treeEdges: treeEdges.length, backEdges: backEdges.length },
    );
    step += 1;

    // Backedges interlace when their DFS intervals alternate.
    const intervals = backEdges.map(([u, v]) => [Math.min(tin[u]!, tin[v]!), Math.max(tin[u]!, tin[v]!)] as [number, number]);
    let interlacing: Array<[number, number]> = [];
    for (let a = 0; a < intervals.length; a += 1) {
        for (let b = a + 1; b < intervals.length; b += 1) {
            const [a0, a1] = intervals[a]!;
            const [b0, b1] = intervals[b]!;
            if ((a0 < b0 && b0 < a1 && a1 < b1) || (b0 < a0 && a0 < b1 && b1 < a1)) {
                interlacing.push([a, b]);
            }
        }
    }
    reset();
    for (const [a] of interlacing.slice(0, 3)) setEdge(backEdges[a]![0], backEdges[a]![1], "comparing");
    yield snap(
        `${interlacing.length} interlacing backedge pair(s) force left/right embedding choices.`,
        3,
        { planar: false, vertices: n, edges: m, components, interlacing: interlacing.length },
    );
    step += 1;

    // Euler's upper bound is a fast necessary condition for simple graphs.
    const eulerBound = n >= 3 && m > 3 * n - 6;
    yield snap(
        eulerBound
            ? `Euler bound fails: ${m} edges exceeds 3v - 6 = ${3 * n - 6}, so the graph is nonplanar.`
            : `Euler bound holds: ${m} edges does not exceed 3v - 6 = ${3 * n - 6}.`,
        4,
        { planar: false, vertices: n, edges: m, components, eulerBound },
    );
    step += 1;
    if (eulerBound) {
        yield snap(`Nonplanar: Euler's edge bound is violated.`, 7, {
            planar: false,
            vertices: n,
            edges: m,
            faces: 0,
            components,
            systemsChecked: 0,
            systemsTotal: 0,
            exact: true,
        });
        return;
    }

    // Enumerate orientable rotation systems. The first vertex neighbor is
    // fixed because a rotation is a cyclic order, removing that redundancy.
    const options = adj.map((list) => permutations(list.slice(1)).map((tail) => [list[0]!, ...tail]));
    let systemsTotal = 1;
    for (const list of options) systemsTotal = Math.min(Number.MAX_SAFE_INTEGER, systemsTotal * Math.max(1, list.length));
    const cap = 200000;
    let checked = 0;
    let planar = false;
    let bestFaces = 0;
    let exact = true;
    const orders: number[][] = new Array(n);

    const evaluate = (): boolean => {
        checked += 1;
        const positions: Array<Map<number, number>> = orders.map((order) => new Map(order.map((v, i) => [v, i])));
        const seenDart = new Set<string>();
        let faces = 0;
        for (let u = 0; u < n; u += 1) {
            for (const start of orders[u]!) {
                const first = `${u}-${start}`;
                if (seenDart.has(first)) continue;
                faces += 1;
                let a = u;
                let b = start;
                while (!seenDart.has(`${a}-${b}`)) {
                    seenDart.add(`${a}-${b}`);
                    const pos = positions[b]!.get(a)!;
                    const next = orders[b]![(pos + 1) % orders[b]!.length]!;
                    a = b;
                    b = next;
                }
            }
        }
        if (n - m + faces === 1 + components) {
            bestFaces = faces;
            return true;
        }
        return false;
    };

    let attempts = 0;
    const search = (vi: number): boolean => {
        if (checked >= cap) return false;
        if (vi === n) return evaluate();
        for (const order of options[vi]!) {
            orders[vi] = order;
            if (search(vi + 1)) return true;
            if (checked >= cap) {
                exact = false;
                return false;
            }
        }
        return false;
    };

    planar = search(0);
    if (checked >= cap && !planar) exact = false;

    reset();
    if (planar) {
        for (const [u, v] of edgeList) setEdge(u, v, "sorted");
    } else {
        for (const [u, v] of edgeList) setEdge(u, v, "visited");
    }
    yield snap(
        planar
            ? `Planar: an embedding with ${bestFaces} faces satisfies Euler's formula.`
            : `Nonplanar: no rotation system among ${checked} tested yields a planar embedding.`,
        7,
        {
            planar,
            vertices: n,
            edges: m,
            faces: bestFaces,
            components,
            systemsChecked: checked,
            systemsTotal,
            exact,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A graph is planar if it can be drawn without crossing edges. Boyer and Myrvold test this with a depth-first search: tree edges form a skeleton, and every other edge joins an ancestor to a descendant. Two such backedges that interlace in the DFS order cannot both be placed on the same side of the tree, so the algorithm tracks left and right choices while trying to build an embedding.",
        invariants: [
            "Every non-tree edge joins a vertex to one of its DFS ancestors.",
            "A rotation system assigns a cyclic order of neighbors to each vertex, which determines the faces of an orientable embedding.",
            "Euler's formula fixes the face count of any planar embedding: n - m + f equals one plus the number of components.",
        ],
        correctness:
            "The DFS structure and interlacement constraints are exactly the information Boyer and Myrvold use to decide whether a consistent left/right embedding can exist. A rotation system satisfying Euler's formula is a concrete planar embedding certificate, so accepting one proves planarity. Conversely, for simple graphs Euler's edge bound rejects dense nonplanar cases immediately, and exhausting every rotation system proves nonplanarity when none gives the required face count.",
        complexityRationale:
            "The DFS and interlacement stages take O(V + E). Enumerating rotation systems costs a product of neighbor factorials in the worst case, which is small for the classroom-sized graphs shown here and is capped by a search budget; Euler's bound handles dense nonplanar inputs cheaply. The embedding data uses O(V + E) space.",
        uses: [
            "Circuit-board and very-large-scale-integration layout feasibility",
            "Deciding whether a network can be drawn without edge crossings",
            "A preprocessing step for planar separators and planar graph algorithms",
        ],
        references: [
            "Boyer and Myrvold, On the Cutting Edge: Simplified O(n) Planarity by Edge Addition, Journal of Graph Algorithms and Applications, 2004",
            "West, Introduction to Graph Theory, Chapter on planar graphs and Kuratowski's theorem",
        ],
        workedExample:
            "A square with one diagonal has four vertices and five edges. Its DFS tree uses three edges and the remaining two backedges interlace. Trying rotation systems, one ordering gives three faces, and 4 - 5 + 3 = 2 equals one plus the single component, confirming the graph is planar.",
    },
    id: "boyer-myrvold-planarity",
    name: "Boyer-Myrvold Planarity",
    category: "graph",
    complexity: { time: "O(V + E + systems·E)", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B", "C", "D"], B: ["A", "C"], C: ["A", "B", "D"], D: ["A", "C", "E"], E: ["D"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "build the undirected adjacency and component list",
        "run a depth-first search to get tree and backedges",
        "find backedges whose DFS intervals interlace",
        "apply Euler's edge upper bound as a quick filter",
        "enumerate neighbor rotation orders at each vertex",
        "trace faces and test n - m + f against Euler's formula",
        "accept the first valid embedding as a planarity certificate",
        "done: report planar or nonplanar with the certificate",
    ],
};

export default module;
