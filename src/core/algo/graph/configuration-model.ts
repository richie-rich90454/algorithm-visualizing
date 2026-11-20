/**
 * configuration-model.ts - Configuration Model
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The configuration model builds a random graph with a prescribed degree
 * sequence. Give each vertex a number of stubs equal to its target degree,
 * shuffle the stubs, and repeatedly join two of them. Pairs that would make a
 * self-loop or a duplicate edge are rejected and the stubs are retried, so the
 * result is a simple graph whose degrees match the sequence whenever it is
 * graphical. A seed makes the pairing reproducible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(S^2) worst case for rejection scanning, S the stub count
 *   Space: O(V + E) for stubs and the edge set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each accepted edge appears one frame at a time in green.
 *   - The final frame compares target and realized degrees.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface GenInput {
    degrees?: number[];
    seed?: number;
}

function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

const key = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GenInput | null) ?? {};
    const raw = Array.isArray(task.degrees) && task.degrees.length > 0 ? task.degrees : [3, 2, 2, 2, 1];
    const degrees = raw.slice(0, 40).map((value) => Math.max(0, Math.min(20, Math.floor(Number(value)) || 0)));
    const n = degrees.length;
    const seed = Math.floor(Number(task.seed ?? 1)) || 1;
    const rng = makeRng(seed);
    const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : ""));
    const nodes = makeGraphNodes(labels);

    const stubs: number[] = [];
    for (let v = 0; v < n; v += 1) {
        for (let s = 0; s < (degrees[v] ?? 0); s += 1) {
            stubs.push(v);
        }
    }
    if (stubs.length % 2 === 1) {
        stubs.pop();
    }
    for (let i = stubs.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const temp = stubs[i] as number;
        stubs[i] = stubs[j] as number;
        stubs[j] = temp;
    }

    const edgeSet = new Set<string>();
    const realized = new Array<number>(n).fill(0);
    const edgeLabels: string[] = [];
    let rejected = 0;

    const buildEdges = (): Array<{ id: string; sourceId: string; targetId: string; label: string; state: EntityState; directed: boolean }> =>
        [...edgeSet].sort().map((pair) => {
            const [a, b] = pair.split("-").map(Number);
            return {
                id: `edge-${labels[a ?? 0]}-${labels[b ?? 0]}`,
                sourceId: `node-${labels[a ?? 0]}`,
                targetId: `node-${labels[b ?? 0]}`,
                label: "",
                state: "idle" as EntityState,
                directed: false,
            };
        });
    const meta = (rejects: number) => ({
        n,
        seed,
        target: [...degrees],
        realized: [...realized],
        rejected: rejects,
        stubCount: stubs.length,
        edgeCount: edgeSet.size,
        edges: [...edgeLabels],
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: [],
        description: `Configuration model: ${stubs.length} stubs shuffled for ${n} vertices with a seeded pairing.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: meta(0),
    };
    step += 1;

    let guard = 0;
    while (stubs.length >= 2 && guard < 10000) {
        guard += 1;
        const a = stubs[0] as number;
        const b = stubs[1] as number;
        const kk = key(a, b);
        if (a !== b && !edgeSet.has(kk)) {
            edgeSet.add(kk);
            realized[a] = (realized[a] ?? 0) + 1;
            realized[b] = (realized[b] ?? 0) + 1;
            edgeLabels.push(`${labels[a]}-${labels[b]}`);
            stubs.splice(0, 2);
            const edges = buildEdges();
            const active = edges.find((edge) => edge.id === `edge-${labels[a]}-${labels[b]}`);
            if (active) {
                active.state = "active";
            }
            yield {
                stepNumber: step,
                entities: nodes.map((node) => ({ ...node })),
                edges,
                description: `Paired stubs into edge ${labels[a]}-${labels[b]}.`,
                codeLineNumber: 3,
                layout: "graph",
                meta: meta(rejected),
            };
            step += 1;
            continue;
        }
        rejected += 1;
        let swapIndex = -1;
        for (let t = 2; t < stubs.length; t += 1) {
            const candidate = stubs[t] as number;
            if (candidate !== a && !edgeSet.has(key(a, candidate))) {
                swapIndex = t;
                break;
            }
        }
        if (swapIndex >= 0) {
            const partner = stubs[swapIndex] as number;
            stubs.splice(swapIndex, 1);
            stubs.splice(1, 0, partner);
        } else {
            stubs.splice(0, 2);
        }
    }

    for (const node of nodes) {
        node.state = "sorted";
    }
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: buildEdges(),
        description: `Configuration model complete: ${edgeSet.size} simple edges, ${rejected} rejected pairings.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: meta(rejected),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If you only care about the degree sequence, forget edges at first and hand each vertex as many loose ends as its target degree. Shuffle the loose ends and tie them together at random. That produces a graph with exactly the degree sequence you asked for, up to the small corrections needed to avoid self-loops and repeated edges.",
        invariants: [
            "Every stub belongs to a vertex and is used at most once.",
            "No accepted pair joins a vertex to itself or repeats an existing edge.",
            "Realized degrees never exceed the target degrees.",
        ],
        correctness:
            "A uniformly shuffled stub list makes any pairing of stubs equally likely, which is the defining distribution of the configuration model. Rejecting a pair when the two stubs share a vertex or an edge already exists preserves simplicity; when a graphical sequence is used, retrying with a valid partner realizes every target degree.",
        complexityRationale:
            "Building the stub list touches the sum of degrees, and each rejected pair may scan the remaining stubs, so the worst case is O(S^2) for S stubs; storing stubs and edges uses O(V + E) space.",
        uses: [
            "Generating null graphs with a fixed degree distribution",
            "Testing how network properties depend only on degrees",
            "Modeling contact networks with known connectivity counts",
        ],
        references: [
            "Molloy and Reed, A Critical Point for Random Graphs with a Given Degree Sequence, 1995",
            "Newman, Networks: An Introduction, Chapter 13",
        ],
        workedExample:
            "With target degrees 2, 2, 2, 2 there are eight stubs. After shuffling, pairing them as A-B, A-C, B-D, and C-D realizes all four degree-2 targets and forms a simple four-cycle with no self-loops.",
    },
    id: "configuration-model",
    name: "Configuration Model",
    category: "graph",
    complexity: { time: "O(S^2)", space: "O(V + E)" },
    defaultInput: { degrees: [3, 2, 2, 2, 1], seed: 1 },
    visualType: "graph",
    run,
    pseudocode: [
        "give each vertex a number of stubs equal to its target degree",
        "shuffle all stubs with a seeded random generator",
        "while at least two stubs remain take the first two",
        "if they form a self-loop or duplicate edge find a valid partner",
        "join the stubs into an edge and remove them",
        "discard stubs that cannot form any valid edge",
        "done: report the simple graph and realized degrees",
    ],
};

export default module;
