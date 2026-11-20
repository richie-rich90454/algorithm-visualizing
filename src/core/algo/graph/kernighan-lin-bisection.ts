/**
 * kernighan-lin-bisection.ts - Kernighan-Lin Balanced Graph Bisection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Kernighan-Lin improves a balanced partition of a graph into two equal sets.
 * One pass repeatedly swaps the best unlocked pair across the cut, using a
 * gain that accounts for how the swap changes the internal and external cost
 * of every still-unlocked vertex. The best prefix of swaps is kept and the
 * pass repeats until no improving prefix exists.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(passes * V^3) with a quadratic pair scan per pass
 *   Space: O(V + E) for adjacency, gain arrays, and the swap log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices in side A are BLUE; vertices in side B are ORANGE.
 *   - The chosen swap pair flashes YELLOW; cut edges are RED.
 *   - The final frame reports the cut size and the number of swaps applied.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;

interface Pair {
    a: string;
    b: string;
    gain: number;
    cumulative: number;
}

function undirectedEdges(adjacency: Adj): Array<{ a: string; b: string; id: string }> {
    const vertices = Object.keys(adjacency).sort();
    const seen = new Set<string>();
    const result: Array<{ a: string; b: string; id: string }> = [];
    for (const a of vertices) {
        for (const raw of adjacency[a] ?? []) {
            const b = String(raw);
            if (!adjacency[b] || a === b) continue;
            const key = [a, b].sort().join("|");
            if (seen.has(key)) continue;
            seen.add(key);
            result.push({ a, b, id: `edge-${[a, b].sort().join("-")}` });
        }
    }
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Adj; partition?: Record<string, string> } | null) ?? {};
    const adjacency: Adj = task.adjacency ?? {
        A: ["B", "C", "E"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["B", "C", "E", "F"],
        E: ["A", "D", "F"],
        F: ["D", "E"],
    };
    const vertices = Object.keys(adjacency).sort();
    if (vertices.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph - there is nothing to bisect.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { cutSize: 0, swapsApplied: 0, passes: 0 },
        };
        return;
    }

    const edges = undirectedEdges(adjacency);
    const neighbors = new Map<string, string[]>(vertices.map((v) => [v, adjacency[v] ?? []]));
    const weight = (a: string, b: string): number =>
        (adjacency[a] ?? []).includes(b) || (adjacency[b] ?? []).includes(a) ? 1 : 0;

    const side = new Map<string, 0 | 1>();
    vertices.forEach((v, index) => {
        const requested = task.partition?.[v];
        side.set(v, requested === "A" || requested === "B" ? (requested === "A" ? 0 : 1) : index % 2 === 0 ? 0 : 1);
    });
    // Keep the partition balanced for an odd vertex count.
    const zeros = vertices.filter((v) => side.get(v) === 0);
    if (zeros.length > Math.ceil(vertices.length / 2)) side.set(zeros[zeros.length - 1] as string, 1);

    const cutSize = (): number => edges.filter((e) => side.get(e.a) !== side.get(e.b)).length;
    const external = (v: string): number =>
        (neighbors.get(v) ?? []).filter((u) => side.get(u) !== side.get(v)).length;
    const internal = (v: string): number =>
        (neighbors.get(v) ?? []).filter((u) => side.get(u) === side.get(v)).length;

    const nodes: VisualEntity[] = makeGraphNodes(vertices);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const visualEdges: VisualEdge[] = edges.map((e) => ({
        id: e.id,
        sourceId: `node-${e.a}`,
        targetId: `node-${e.b}`,
        label: "",
        state: "idle",
        directed: false,
    }));

    let step = 0;
    const initialCut = cutSize();
    let passes = 0;
    let totalSwaps = 0;

    const snap = (description: string, line: number, pair: Pair | null, final: boolean): VisualFrame => {
        for (const node of nodes) {
            node.state = side.get(String(node.value)) === 0 ? "sorted" : "active";
        }
        for (const edge of visualEdges) {
            const primal = edges.find((e) => e.id === edge.id);
            const crossing = primal ? side.get(primal.a) !== side.get(primal.b) : false;
            edge.state = crossing ? "error" : "idle";
        }
        if (pair) {
            const a = byId.get(`node-${pair.a}`);
            const b = byId.get(`node-${pair.b}`);
            if (a) a.state = "comparing";
            if (b) b.state = "comparing";
        }
        if (final) for (const node of nodes) node.state = "path";
        return {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: visualEdges.map((e) => ({ ...e })),
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                cutSize: cutSize(),
                initialCut,
                passes,
                swapsApplied: totalSwaps,
                partitionA: vertices.filter((v) => side.get(v) === 0).join(","),
                partitionB: vertices.filter((v) => side.get(v) === 1).join(","),
            },
        };
    };

    yield snap(`Loaded ${vertices.length} vertices and ${edges.length} edges; initial cut ${initialCut}.`, 0, null, false);
    step += 1;

    for (;;) {
        passes += 1;
        const tentative = new Map(side);
        const d = new Map(vertices.map((v) => [v, external(v) - internal(v)]));
        const locked = new Set<string>();
        const chosen: Array<{ a: string; b: string; gain: number }> = [];
        let cumulative = 0;
        let bestPrefix = -1;
        let bestCumulative = 0;
        let improved = false;

        for (let round = 0; round < Math.floor(vertices.length / 2); round += 1) {
            let bestGain = -Infinity;
            let pickA: string | null = null;
            let pickB: string | null = null;
            for (const a of vertices) {
                if (tentative.get(a) !== 0 || locked.has(a)) continue;
                for (const b of vertices) {
                    if (tentative.get(b) !== 1 || locked.has(b)) continue;
                    const gain = (d.get(a) as number) + (d.get(b) as number) - 2 * weight(a, b);
                    if (gain > bestGain) {
                        bestGain = gain;
                        pickA = a;
                        pickB = b;
                    }
                }
            }
            if (pickA === null || pickB === null) break;

            locked.add(pickA);
            locked.add(pickB);
            for (const u of neighbors.get(pickA) ?? []) {
                if (locked.has(u)) continue;
                const delta = tentative.get(u) === 0 ? 2 : -2;
                d.set(u, (d.get(u) as number) + delta);
            }
            for (const u of neighbors.get(pickB) ?? []) {
                if (locked.has(u)) continue;
                const delta = tentative.get(u) === 1 ? 2 : -2;
                d.set(u, (d.get(u) as number) + delta);
            }
            tentative.set(pickA, 1);
            tentative.set(pickB, 0);

            cumulative += bestGain;
            chosen.push({ a: pickA, b: pickB, gain: bestGain });
            if (cumulative > bestCumulative) {
                bestCumulative = cumulative;
                bestPrefix = chosen.length;
            }
            yield snap(
                `Pass ${passes}, swap ${round + 1}: ${pickA}<->${pickB}, gain ${bestGain}, running gain ${cumulative}.`,
                3,
                { a: pickA, b: pickB, gain: bestGain, cumulative },
                false,
            );
            step += 1;
        }

        if (bestPrefix > 0) {
            for (let i = 0; i < bestPrefix; i += 1) {
                const swap = chosen[i];
                if (swap) {
                    side.set(swap.a, 1);
                    side.set(swap.b, 0);
                }
            }
            totalSwaps += bestPrefix;
            improved = true;
            yield snap(
                `Pass ${passes}: keep ${bestPrefix} swap(s) for a total gain of ${bestCumulative}; cut is now ${cutSize()}.`,
                5,
                null,
                false,
            );
            step += 1;
        } else {
            yield snap(`Pass ${passes}: no improving prefix, so the bisection is locally optimal.`, 6, null, false);
            step += 1;
        }
        if (!improved) break;
    }

    yield snap(
        `Bisection complete: cut ${cutSize()} after ${totalSwaps} swap(s) over ${passes} pass(es).`,
        7,
        null,
        true,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of two teams on opposite sides of a rope. Swapping one player from each team changes the cut by how many friends each has on the other side, minus twice the friendship between the swapped pair. Kernighan-Lin tries the most promising swap repeatedly, then keeps only the stretch of swaps that helped overall.",
        invariants: [
            "Each tentative swap flips one vertex in each side, so balance never changes.",
            "The gain of a pair equals the drop in cut size caused by that swap in the current tentative state.",
            "Locked vertices are not chosen again within a single pass.",
        ],
        correctness:
            "The gain update adds or subtracts two for every neighbor whose side relationship changes, which exactly tracks that neighbor's external minus internal count, so the recorded gain equals the true cut reduction. Choosing the best prefix and repeating until no prefix improves means no pass can increase the cut and the final partition is locally optimal under pair swaps.",
        complexityRationale:
            "A pass examines all pairs across the cut, O(V^2) pairs, and there are O(V) rounds, giving O(V^3) per pass; passes are bounded in practice by a small constant. Storing adjacency, gain values, and the swap log uses O(V + E) space.",
        uses: [
            "Partitioning circuit netlists for VLSI placement",
            "Splitting a graph across machines to reduce network traffic",
            "A local refinement step after coarsening in multilevel partitioners",
        ],
        references: [
            "Kernighan and Lin, An Efficient Heuristic Procedure for Partitioning Electrical Networks, 1970",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, heuristics for graph partitioning",
        ],
        workedExample:
            "On two triangles joined by a single bridge, the initial cut is one. Every cross pair has gain at most zero because swapping would create more crossings, so the algorithm keeps no swap and reports the bridge cut as locally optimal.",
    },
    id: "kernighan-lin-bisection",
    name: "Kernighan-Lin Bisection",
    category: "graph",
    complexity: { time: "O(passes * V^3)", space: "O(V + E)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C", "E"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D"],
            D: ["B", "C", "E", "F"],
            E: ["A", "D", "F"],
            F: ["D", "E"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start from a balanced partition of the vertices",
        "compute external minus internal cost for every vertex",
        "while some pair has not been tried in this pass",
        "pick the unlocked cross pair with the largest gain",
        "lock the pair and update the gains of its unlocked neighbors",
        "record the running gain and remember the best prefix",
        "apply the best positive prefix and repeat the pass",
        "stop when no prefix improves and report the cut",
    ],
};

export default module;
