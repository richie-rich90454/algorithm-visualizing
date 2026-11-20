/**
 * dynamic-transitive-closure.ts - Incremental Transitive Closure Maintenance
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rather than rebuilding reachability from scratch after every edge change,
 * this module updates only the rows that can be affected. On an insertion of
 * u -> v, every source that already reaches u gains everything v reaches. On
 * a deletion, every source that reached u and v has its row recomputed with a
 * fresh search. Both rules keep the reachability relation exact while doing
 * far less work than a full recomputation on sparse updates.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V * E) per update in the worst case (one search per affected source)
 *   Space: O(V^2) for the reachability matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are circles and graph edges are directed connections.
 *   - Sources whose reachability row changes are highlighted.
 *   - The current number of reachable pairs is reported in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface Update {
    from: string;
    to: string;
    add: boolean;
}

/** Breadth-first reachability from one vertex over the current edge set. */
function reachableFrom(start: string, edges: Set<string>, vertices: string[]): Set<string> {
    const seen = new Set<string>();
    const queue: string[] = [];
    for (const v of vertices) {
        if (edges.has(`${start}->${v}`)) {
            seen.add(v);
            queue.push(v);
        }
    }
    while (queue.length > 0) {
        const u = queue.shift();
        if (u === undefined) {
            break;
        }
        for (const v of vertices) {
            if (seen.has(v)) {
                continue;
            }
            if (edges.has(`${u}->${v}`)) {
                seen.add(v);
                queue.push(v);
            }
        }
    }
    return seen;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: string[]; updates?: Update[] } | null) ?? {};
    const vertices = Array.isArray(task.vertices) && task.vertices.length > 0
        ? task.vertices.map(String)
        : ["A", "B", "C", "D"];
    const updates: Update[] = Array.isArray(task.updates)
        ? task.updates
              .filter((u) => u && typeof u.from === "string" && typeof u.to === "string")
              .map((u) => ({ from: u.from, to: u.to, add: u.add !== false }))
        : [
              { from: "A", to: "B", add: true },
              { from: "B", to: "C", add: true },
              { from: "C", to: "A", add: true },
              { from: "B", to: "C", add: false },
              { from: "C", to: "D", add: true },
          ];

    const edges = new Set<string>();
    const reach = new Map<string, Set<string>>(vertices.map((v) => [v, new Set<string>()]));
    const nodes = makeGraphNodes(vertices);

    const snap = (
        message: string,
        line: number,
        index: number,
        affected: string[],
    ): VisualFrame => {
        const affectedSet = new Set(affected);
        for (const node of nodes) {
            node.state = affectedSet.has(String(node.value)) ? "active" : "unvisited";
        }
        const visualEdges: VisualEdge[] = [...edges].map((key) => {
            const [source, target] = key.split("->");
            return {
                id: `edge-${source}-${target}`,
                sourceId: `node-${source}`,
                targetId: `node-${target}`,
                label: "",
                state: "idle",
                directed: true,
            };
        });
        let pairs = 0;
        for (const row of reach.values()) {
            pairs += row.size;
        }
        return {
            stepNumber: 0,
            entities: nodes.map((node) => ({ ...node })),
            edges: visualEdges,
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                updateIndex: index,
                updateCount: updates.length,
                edgeCount: edges.size,
                reachablePairs: pairs,
                affectedSources: [...affected],
                closureSize: pairs,
            },
        };
    };

    let step = 0;
    yield {
        ...snap("Start with no edges and an empty transitive closure.", 1, 0, []),
        stepNumber: step,
    };
    step += 1;

    for (let i = 0; i < updates.length; i += 1) {
        const update = updates[i];
        if (!update || !vertices.includes(update.from) || !vertices.includes(update.to)) {
            continue;
        }
        const key = `${update.from}->${update.to}`;
        const affected: string[] = [];
        if (update.add) {
            const already = reach.get(update.from)?.has(update.to) ?? false;
            edges.add(key);
            if (!already) {
                const targetRow = reach.get(update.to) ?? new Set<string>();
                const gained = new Set<string>([update.to, ...targetRow]);
                for (const s of vertices) {
                    if (s === update.from || (reach.get(s)?.has(update.from) ?? false)) {
                        const row = reach.get(s);
                        if (row && [...gained].some((x) => !row.has(x))) {
                            for (const x of gained) {
                                row.add(x);
                            }
                            affected.push(s);
                        }
                    }
                }
            }
            yield {
                ...snap(
                    `Insert ${key}: ${affected.length} reachability row(s) changed.`,
                    already ? 2 : 3,
                    i + 1,
                    affected,
                ),
                stepNumber: step,
            };
            step += 1;
        } else {
            edges.delete(key);
            for (const s of vertices) {
                const row = reach.get(s);
                if (!row) {
                    continue;
                }
                const canReachU = s === update.from || row.has(update.from);
                if (canReachU && row.has(update.to)) {
                    reach.set(s, reachableFrom(s, edges, vertices));
                    affected.push(s);
                }
            }
            yield {
                ...snap(
                    `Delete ${key}: recomputed ${affected.length} reachability row(s).`,
                    5,
                    i + 1,
                    affected,
                ),
                stepNumber: step,
            };
            step += 1;
        }
    }

    yield {
        ...snap(
            `After ${updates.length} update(s), ${[...reach.values()].reduce((a, r) => a + r.size, 0)} vertex pair(s) are reachable.`,
            7,
            updates.length,
            [],
        ),
        stepNumber: step,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Adding an edge u to v can only help sources that already reach u, and deleting it can only hurt sources that were using u to get to v. By tracking just those sources, the closure is kept correct without recomputing reachability for the whole graph after each small change.",
        invariants: [
            "After each update, row s of the matrix equals the set of vertices reachable from s.",
            "An insertion never removes an existing reachable pair.",
            "A deletion only changes rows of sources that reached both endpoints.",
        ],
        correctness:
            "On insertion of u to v, any new path must consist of a path to u, the new edge, and then a path from v; adding the old reachability set of v to every source reaching u therefore captures exactly the new pairs. On deletion, any source that reached both endpoints might have relied on the deleted edge, so recomputing its row by a fresh search restores the exact set; sources that did not reach both endpoints cannot be affected. Induction over the updates proves correctness.",
        complexityRationale:
            "Each affected source may need to scan all edges during recomputation, and there are at most V sources, so an update costs O(V E) time. Storing one reachability set per vertex uses O(V^2) space.",
        uses: [
            "Maintaining call-graph reachability during incremental compilation",
            "Updating query containment or subsumption after schema edits",
            "Incremental analysis of large dependency networks",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on all-pairs shortest paths",
            "Demers, Westbrook and Sen, Incremental Transitive Closure, 1994",
        ],
        workedExample:
            "With edges A to B, B to C and C to A, every vertex reaches all three. Deleting B to C leaves A able to reach B and C only through A to B, which now stops; the rows for A, B and C are recomputed and the cycle closure shrinks correctly.",
    },
    id: "dynamic-transitive-closure",
    name: "Dynamic Transitive Closure",
    category: "graph",
    complexity: { time: "O(V * E) per update", space: "O(V^2)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D"],
        updates: [
            { from: "A", to: "B", add: true },
            { from: "B", to: "C", add: true },
            { from: "C", to: "A", add: true },
            { from: "B", to: "C", add: false },
            { from: "C", to: "D", add: true },
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize an empty edge set and empty reachability rows",
        "for each update in sequence",
        "on insertion, find sources that reach the tail",
        "add the head and everything it reaches to those rows",
        "on deletion, remove the edge and find affected sources",
        "recompute each affected row with a fresh search",
        "record the number of reachable pairs after the update",
        "report the final transitive closure size",
    ],
};

export default module;
