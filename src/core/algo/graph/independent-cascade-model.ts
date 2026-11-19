/**
 * independent-cascade-model.ts - Independent Cascade Diffusion Model
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The independent cascade model simulates how influence spreads through a
 * network. A set of seed nodes starts active. In each round every node that was
 * just activated gets exactly one independent chance to activate each of its
 * inactive neighbors, with success probability equal to the edge weight. The
 * process stops when no new node is activated.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E) - each edge is attempted at most once from its tail
 *   Space: O(V) for the active sets and frontier
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Active nodes are GREEN; the newest activations are GOLD.
 *   - A successful transmission edge is GREEN; a failed one is RED.
 *   - Each frame reports the full active set and the new frontier.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type WeightedGraph = Record<string, Array<[string, number]>>;

function mulberry32(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Pure simulation returning the active set after each round. */
export function independentCascadeRounds(
    graph: WeightedGraph,
    seeds: string[],
    seed = 1,
): string[][] {
    const rand = mulberry32(seed);
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat().map((e) => e[0])])];
    const active = new Set(seeds.filter((s) => labels.includes(s)));
    const rounds: string[][] = [[...active].sort()];
    let frontier = [...active];
    while (frontier.length > 0) {
        const next: string[] = [];
        for (const u of frontier) {
            for (const [v, p] of graph[u] ?? []) {
                if (active.has(v)) continue;
                if (rand() < p) {
                    active.add(v);
                    next.push(v);
                }
            }
        }
        frontier = next;
        rounds.push([...active].sort());
    }
    return rounds;
}

function makeEntities(labels: string[], active: Set<string>, fresh: Set<string>): VisualEntity[] {
    return labels.map((label) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: (fresh.has(label) ? "active" : active.has(label) ? "sorted" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label, active: active.has(label) },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: WeightedGraph; seeds?: string[]; seed?: number } | null) ?? {};
    const graph: WeightedGraph = task.graph ?? {
        A: [["B", 1], ["C", 1]],
        B: [["D", 1]],
        C: [["D", 0]],
        D: [["E", 1]],
        E: [],
        F: [["A", 1]],
    };
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat().map((e) => e[0])])].sort();
    const seeds = Array.isArray(task.seeds) && task.seeds.length > 0 ? task.seeds : ["A"];
    const rand = mulberry32(Math.floor(task.seed ?? 1));
    const active = new Set(seeds.filter((s) => labels.includes(s)));
    let frontier = [...active];
    let step = 0;

    const emit = (
        description: string,
        codeLineNumber: number,
        fresh: Set<string>,
        edgeStates: Map<string, EntityState>,
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => {
        const edges: VisualEdge[] = [];
        for (const [u, pairs] of Object.entries(graph)) {
            for (const [v, p] of pairs) {
                edges.push({
                    id: `edge-${u}-${v}`,
                    sourceId: `node-${u}`,
                    targetId: `node-${v}`,
                    label: String(p),
                    state: edgeStates.get(`${u}-${v}`) ?? "idle",
                    directed: true,
                });
            }
        }
        const s = step;
        step += 1;
        return {
            stepNumber: s,
            entities: makeEntities(labels, active, fresh),
            edges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: { seeds: [...seeds].sort(), activeList: [...active].sort(), round: meta["round"] ?? 0, ...meta },
        };
    };

    yield emit(`Independent cascade from seeds [${seeds.join(", ")}].`, 0, new Set(active), new Map(), { round: 0 });
    let round = 0;
    while (frontier.length > 0) {
        round += 1;
        const next: string[] = [];
        const fresh = new Set<string>();
        const edgeStates = new Map<string, EntityState>();
        for (const u of frontier) {
            for (const [v, p] of graph[u] ?? []) {
                if (active.has(v)) continue;
                edgeStates.set(`${u}-${v}`, "comparing");
                if (rand() < p) {
                    active.add(v);
                    next.push(v);
                    fresh.add(v);
                    edgeStates.set(`${u}-${v}`, "path");
                } else {
                    edgeStates.set(`${u}-${v}`, "error");
                }
            }
        }
        yield emit(
            `Round ${round}: ${next.length} new activation(s) [${[...fresh].sort().join(", ")}].`,
            2,
            fresh,
            edgeStates,
            { round, newlyActive: [...fresh].sort(), frontier: [...frontier].sort() },
        );
        frontier = next;
    }
    yield emit(`Diffusion complete: ${active.size} node(s) active [${[...active].sort().join(", ")}].`, 4, new Set(), new Map(), { round, final: true, activeCount: active.size });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The independent cascade model treats influence like a contagion. Each newly activated node tries once to activate every inactive neighbor, succeeding with the probability written on that edge. Because each attempt is independent, one powerful seed can start a large cascade while another fails, which is why influence maximization chooses seeds carefully.",
        invariants: [
            "A node activates at most once and remains active for the rest of the run.",
            "Each edge from a newly active node is attempted at most once in total.",
            "The active set only grows; no node ever becomes inactive.",
        ],
        correctness:
            "The algorithm maintains a frontier of nodes activated in the previous round. Every frontier node makes one independent attempt per inactive neighbor, matching the definition of the model. Nodes activated in a round form the next frontier, and the loop ends only when that frontier is empty, so the final set is exactly the set of nodes reachable by a chain of successful transmissions.",
        complexityRationale:
            "Each directed edge is attempted only when its tail is newly active, so at most E random draws and edge checks occur. Active sets and the frontier use O(V) space, giving O(E) time and O(V) space.",
        uses: [
            "Modeling information and rumor spread in social networks",
            "Viral marketing and influence maximization",
            "Epidemic-style diffusion analysis and outbreak scenarios",
        ],
        references: [
            "Kempe, Kleinberg, and Tardos, Maximizing the Spread of Influence through a Social Network, KDD 2003",
            "Granovetter, Threshold Models of Collective Behavior, 1978",
        ],
        workedExample:
            "With seeds {A}, edge A->B of probability 1 and B->D of probability 1, while A->C has probability 0, round one activates B, round two activates D, and the cascade stops with {A, B, D} active.",
    },
    id: "independent-cascade-model",
    name: "Independent Cascade Model",
    category: "graph",
    complexity: { time: "O(E)", space: "O(V)" },
    defaultInput: {
        graph: {
            A: [["B", 1], ["C", 1]],
            B: [["D", 1]],
            C: [["D", 0]],
            D: [["E", 1]],
            E: [],
            F: [["A", 1]],
        },
        seeds: ["A"],
        seed: 1,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "mark the seed vertices active and place them in the frontier",
        "while the frontier is not empty",
        "for each newly active vertex and each inactive neighbor",
        "draw a random number and compare it with the edge probability",
        "on success activate the neighbor and add it to the next frontier",
        "replace the frontier with the next frontier",
        "report the active set after each round",
        "done: no frontier remains and diffusion has stopped",
    ],
};

export default module;
