/**
 * loop-erased-random-walk.ts - Loop-Erased Random Walk
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A random walk wanders through a graph until it reaches the target. Whenever
 * the walk steps onto a vertex it has already visited, the loop just created
 * is erased and the walk resumes from that earlier vertex. The surviving
 * trace is always a simple path from start to target. With a uniform random
 * choice at each vertex this is the classic loop-erased random walk used to
 * generate uniform spanning trees.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * degree) with a cap on steps
 *   Space: O(V) for the current trace and the visited index
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current trace is CYAN (path); the current vertex is YELLOW.
 *   - Edges removed by loop erasure flash RED for one frame.
 *   - The final simple path stays CYAN and its length is reported in meta.
 */

import type { AlgorithmModule, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;

/** Deterministic 32-bit pseudo-random generator (mulberry32). */
function rng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { adjacency?: Adj; start?: string; target?: string; seed?: number; maxSteps?: number } | null
    ) ?? {};
    const adjacency: Adj = task.adjacency ?? {
        A: ["B", "C"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D", "E"],
        D: ["B", "C", "E"],
        E: ["C", "D", "F"],
        F: ["E"],
    };
    const labels = [
        ...new Set([
            ...Object.keys(adjacency),
            ...Object.values(adjacency).flatMap((ns) => ns.map((n) => String(n))),
        ]),
    ].sort();
    if (labels.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph - there is no walk to run.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { reached: false, pathLength: 0, steps: 0 },
        };
        return;
    }
    const start = task.start && labels.includes(task.start) ? task.start : (labels[0] as string);
    const target = task.target && labels.includes(task.target) ? task.target : labels[labels.length - 1] as string;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const maxSteps = typeof task.maxSteps === "number" ? Math.max(1, Math.floor(task.maxSteps)) : 120;
    const next = rng(seed);
    const allEdges: Array<{ a: string; b: string; id: string }> = [];
    const seen = new Set<string>();
    for (const a of labels) {
        for (const b of adjacency[a] ?? []) {
            if (!labels.includes(b) || a === b) continue;
            const key = `${a}|${b}`;
            if (seen.has(key)) continue;
            seen.add(key);
            allEdges.push({ a, b, id: `edge-${a}-${b}` });
        }
    }

    const nodes = makeGraphNodes(labels);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const trace: string[] = [start];
    let erased: string[] = [];
    let steps = 0;
    let reached = start === target;
    let step = 0;

    const snap = (description: string, line: number): VisualFrame => {
        for (const node of nodes) node.state = "unvisited";
        for (const v of trace) {
            const n = byId.get(`node-${v}`);
            if (n) n.state = "path";
        }
        const current = byId.get(`node-${trace[trace.length - 1] ?? start}`);
        if (current) current.state = "comparing";
        const startNode = byId.get(`node-${start}`);
        const targetNode = byId.get(`node-${target}`);
        if (startNode) startNode.state = "active";
        if (targetNode) targetNode.state = reached ? "sorted" : "active";
        const edges = allEdges.map((e) => {
            const idxA = trace.indexOf(e.a);
            const idxB = trace.indexOf(e.b);
            const onTrace = idxA >= 0 && idxB === idxA + 1;
            const erasedEdge = erased.includes(`${e.a}|${e.b}`);
            return {
                id: e.id,
                sourceId: `node-${e.a}`,
                targetId: `node-${e.b}`,
                label: "",
                state: erasedEdge ? ("error" as const) : onTrace ? ("path" as const) : ("idle" as const),
                directed: true,
            };
        });
        return {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                reached,
                pathLength: trace.length,
                steps,
                trace: trace.join(","),
                seed,
            },
        };
    };

    yield snap(`Start at ${start}; erase loops until ${target} is reached.`, 0);
    step += 1;

    while (!reached && steps < maxSteps) {
        erased = [];
        const current = trace[trace.length - 1] as string;
        const candidates = (adjacency[current] ?? []).filter((c) => labels.includes(c));
        if (candidates.length === 0) {
            yield snap(`Dead end at ${current}: the walk cannot continue.`, 4);
            step += 1;
            break;
        }
        const chosen = candidates[Math.floor(next() * candidates.length)] as string;
        steps += 1;
        const index = trace.indexOf(chosen);
        if (index >= 0) {
            for (let i = index; i < trace.length - 1; i += 1) {
                erased.push(`${trace[i]}|${trace[i + 1]}`);
            }
            trace.length = index + 1;
            yield snap(`Step ${steps}: walked to ${chosen}, which is already on the trace - erase the loop.`, 3);
        } else {
            trace.push(chosen);
            yield snap(`Step ${steps}: extend the trace to ${chosen}.`, 2);
        }
        step += 1;
        reached = chosen === target;
    }

    yield snap(
        reached
            ? `Reached ${target} after ${steps} step(s); the loop-free path has ${trace.length} vertices.`
            : `Stopped after ${steps} step(s) without reaching ${target}.`,
        6,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Let a drunken walker move at random through the graph. Each time the walker stumbles back onto ground already covered, cut out the circular detour and start again from that earlier spot. Only the non-circular part is kept, so the final trail never repeats a vertex.",
        invariants: [
            "The trace always begins at the start vertex and is a simple path.",
            "Erasing a loop removes exactly the segment after the repeated vertex.",
            "The walk never leaves the graph and always follows an existing edge.",
        ],
        correctness:
            "The trace starts as a single vertex. Extending it with a new vertex keeps it simple, and truncating at the first occurrence of a repeated vertex removes precisely the closed segment between the two visits, again leaving a simple path. If the target is reached, the trace is therefore a simple start-to-target path; in the limit the erased walk has the uniform spanning-tree distribution of Wilson's theorem.",
        complexityRationale:
            "Each step chooses among the current vertex's neighbors and finds the repeated vertex by a linear scan of the trace, so a step costs O(degree + trace length), at most O(V + E). The cap on steps bounds total time, and the trace plus its index use O(V) space.",
        uses: [
            "Generating uniform spanning trees through Wilson's algorithm",
            "Sampling simple paths in Markov chain Monte Carlo methods",
            "Modeling diffusion and search processes on networks",
        ],
        references: [
            "Lawler, Schramm and Werner, The Loop-Erased Random Walk and a Spanning Tree Measure, 2001",
            "Wilson, Generating Random Spanning Trees More Quickly Than the Cover Time, 1996",
        ],
        workedExample:
            "From A in a triangle-with-tail graph, suppose the walk visits A-B-C-B. The second B repeats a vertex, so the segment B-C-B is deleted and the trace becomes A-B. Continuing to D and then E leaves the simple path A-B-D-E.",
    },
    id: "loop-erased-random-walk",
    name: "Loop-Erased Random Walk",
    category: "graph",
    complexity: { time: "O(steps * (V + degree))", space: "O(V)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D", "E"],
            D: ["B", "C", "E"],
            E: ["C", "D", "F"],
            F: ["E"],
        },
        start: "A",
        target: "F",
        seed: 7,
        maxSteps: 120,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "set the trace to the start vertex",
        "while the target has not been reached and steps remain",
        "choose a random neighbor of the current vertex",
        "if that neighbor is already on the trace, erase the loop back to it",
        "otherwise append the neighbor to the trace",
        "advance the current vertex to the chosen neighbor",
        "stop when the target is reached or the step budget expires",
        "report the loop-free path and its length",
    ],
};

export default module;
