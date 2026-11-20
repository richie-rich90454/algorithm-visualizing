/**
 * barabasi-albert-model.ts - Barabasi-Albert Preferential Attachment
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Barabasi-Albert model grows a scale-free network one vertex at a time.
 * Start from a small complete seed graph, then attach each new vertex to m
 * existing vertices chosen with probability proportional to their degree.
 * Popularity breeds popularity, so a few hubs emerge and the degree
 * distribution develops a heavy tail. A seed makes growth reproducible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m * d) with a stub-list draw of average degree d
 *   Space: O(V + E) for edges and the degree-proportional stub list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A new vertex flashes while its m links are chosen.
 *   - The hub is highlighted in the final frame.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface GenInput {
    n?: number;
    m0?: number;
    m?: number;
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
    const n = Math.max(3, Math.min(40, Math.floor(Number(task.n ?? 10)) || 10));
    let m0 = Math.max(2, Math.floor(Number(task.m0 ?? 3)) || 3);
    m0 = Math.min(m0, n);
    let m = Math.max(1, Math.floor(Number(task.m ?? 2)) || 2);
    m = Math.min(m, m0);
    const seed = Math.floor(Number(task.seed ?? 1)) || 1;
    const rng = makeRng(seed);
    const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : ""));
    const nodes = makeGraphNodes(labels);
    const edgeSet = new Set<string>();
    const degree = new Array<number>(n).fill(0);
    const addEdge = (a: number, b: number): void => {
        const kk = key(a, b);
        if (a === b || edgeSet.has(kk)) {
            return;
        }
        edgeSet.add(kk);
        degree[a] = (degree[a] ?? 0) + 1;
        degree[b] = (degree[b] ?? 0) + 1;
    };
    for (let i = 0; i < m0; i += 1) {
        for (let j = i + 1; j < m0; j += 1) {
            addEdge(i, j);
        }
    }

    const edgeLabels = (): string[] => [...edgeSet].sort().map((pair) => {
        const [a, b] = pair.split("-").map(Number);
        return `${labels[a ?? 0]}-${labels[b ?? 0]}`;
    });
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
    const meta = (added: number) => ({
        n,
        m0,
        m,
        seed,
        added,
        edgeCount: edgeSet.size,
        edges: edgeLabels(),
        degree: [...degree],
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: buildEdges(),
        description: `Seed graph of ${m0} vertices; each new vertex attaches to ${m} vertices by degree-proportional preference.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: meta(0),
    };
    step += 1;

    for (let i = m0; i < n; i += 1) {
        const chosen = new Set<number>();
        let attempts = 0;
        while (chosen.size < m && attempts < 1000) {
            attempts += 1;
            const stubs: number[] = [];
            for (let v = 0; v < i; v += 1) {
                const count = degree[v] ?? 0;
                for (let s = 0; s < count; s += 1) {
                    stubs.push(v);
                }
            }
            if (stubs.length === 0) {
                break;
            }
            const target = stubs[Math.floor(rng() * stubs.length)] as number;
            if (target === i || chosen.has(target)) {
                continue;
            }
            chosen.add(target);
            addEdge(i, target);
        }
        const edges = buildEdges();
        const node = nodes[i];
        if (node) {
            node.state = "comparing";
        }
        for (const target of chosen) {
            const active = edges.find((edge) => edge.id === `edge-${labels[i]}-${labels[target]}`);
            if (active) {
                active.state = "active";
            }
        }
        yield {
            stepNumber: step,
            entities: nodes.map((item) => ({ ...item })),
            edges,
            description: `Added vertex ${labels[i]} linked to ${[...chosen].map((v) => labels[v]).join(", ")}.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: meta(i - m0 + 1),
        };
        step += 1;
    }

    const hub = degree.indexOf(Math.max(...degree));
    for (const node of nodes) {
        node.state = "visited";
    }
    const hubNode = nodes[hub];
    if (hubNode) {
        hubNode.state = "sorted";
    }
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: buildEdges(),
        description: `Scale-free graph complete with ${edgeSet.size} edges; hub ${labels[hub]} has degree ${degree[hub]}.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: { ...meta(n - m0), hub: labels[hub], hubDegree: degree[hub] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Successful nodes attract more success. Starting from a tiny clique, each arriving vertex picks its friends with a probability proportional to how many friends they already have. This rich-get-richer rule produces a few very connected hubs and many poorly connected vertices, giving the heavy-tailed degree distribution seen in the web and social networks.",
        invariants: [
            "Every new vertex attaches to exactly m distinct earlier vertices.",
            "The graph stays simple: no self-loops and no duplicate edges.",
            "Selection probability of a vertex equals its current degree over total degree.",
        ],
        correctness:
            "Expanding the degree-proportional distribution into one stub per unit of degree and drawing a stub uniformly gives exactly the preferential-attachment probability. Rejecting already chosen targets yields m distinct neighbors, and the seed clique guarantees every later vertex has a nonempty candidate pool, so each step is well defined and the graph stays simple.",
        complexityRationale:
            "Rebuilding a stub list of length two E for each of the n-m additions costs O(n * E) in total, bounded by O(n * m * d) with average degree d; adjacency and degrees use O(V + E) space.",
        uses: [
            "Modeling the growth of the web and citation networks",
            "Explaining hub formation in social and biological networks",
            "Generating scale-free test graphs for robustness studies",
        ],
        references: [
            "Barabasi and Albert, Emergence of Scaling in Random Networks, 1999",
            "Albert, Jeong, and Barabasi, Error and Attack Tolerance of Complex Networks, 2000",
        ],
        workedExample:
            "Starting from seed vertices A, B, C and adding D with m=2, the three seed vertices each have degree 2, so D picks two of them uniformly. If it picks A and B, their degrees rise to 3 and they are more likely to attract the next vertex E.",
    },
    id: "barabasi-albert-model",
    name: "Barabasi-Albert Model",
    category: "graph",
    complexity: { time: "O(n * m * d)", space: "O(V + E)" },
    defaultInput: { n: 10, m0: 3, m: 2, seed: 1 },
    visualType: "graph",
    run,
    pseudocode: [
        "start from a complete seed graph of m0 vertices",
        "for each new vertex repeat m times",
        "build a list with one entry per unit of current degree",
        "draw an entry uniformly to pick a neighbor by preference",
        "skip vertices already chosen for this new vertex",
        "add the m edges to the graph",
        "done: report the grown scale-free graph",
    ],
};

export default module;
