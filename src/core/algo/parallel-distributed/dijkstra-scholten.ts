/**
 * dijkstra-scholten.ts - Dijkstra-Scholten Termination Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Dijkstra-Scholten algorithm detects when a distributed computation has
 * fully quiesced, even though there is no global clock or shared memory. It
 * overlays a spanning tree on the processes. A process that has finished its
 * own work waits until every child in the tree has reported back, then sends a
 * single signal to its parent. When the root has finished its work and heard
 * from all children, it declares termination. A process that receives new work
 * after sending its signal is not covered by this simplified model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + workTicks) rounds for n processes
 *   Space: O(n) for the per-process flags and the tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes sit at their tree depth, colored busy / idle / reported.
 *   - The edge carrying the latest report is highlighted.
 *   - meta carries idle flags, report flags, signal count, and termination.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualEdge, VisualFrame } from "@/types";

function buildPositions(parent: number[]): Array<{ x: number; y: number }> {
    const n = parent.length;
    const depth = Array.from({ length: n }, () => 0);
    for (let i = 0; i < n; i += 1) {
        const p = parent[i] ?? -1;
        if (p >= 0) depth[i] = (depth[p] ?? 0) + 1;
    }
    const byDepth = new Map<number, number[]>();
    for (let i = 0; i < n; i += 1) {
        const d = depth[i] ?? 0;
        if (!byDepth.has(d)) byDepth.set(d, []);
        byDepth.get(d)!.push(i);
    }
    const positions = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
    let maxWidth = 1;
    for (const indices of byDepth.values()) maxWidth = Math.max(maxWidth, indices.length);
    for (const [d, indices] of byDepth) {
        indices.forEach((index, k) => {
            const span = Math.max(1, indices.length - 1);
            positions[index] = {
                x: 300 + (k - span / 2) * (420 / Math.max(1, maxWidth - 1 || 1)),
                y: 120 + d * 110,
            };
        });
    }
    return positions;
}

function makeNodes(
    parent: number[],
    busy: boolean[],
    reported: boolean[],
    terminated: boolean,
): VisualEntity[] {
    const positions = buildPositions(parent);
    return parent.map((_, index) => {
        let state: EntityState = "unvisited";
        if (terminated) {
            state = "path";
        } else if (reported[index]) {
            state = "sorted";
        } else if (busy[index]) {
            state = "active";
        } else {
            state = "visited";
        }
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: `P${index}`,
            value: index,
            state,
            x: positions[index]?.x ?? 0,
            y: positions[index]?.y ?? 0,
            width: 0,
            height: 0,
            metadata: { index, parent: parent[index] ?? -1, busy: busy[index] === true },
        };
    });
}

function makeEdges(parent: number[], signalFrom: number): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let index = 0; index < parent.length; index += 1) {
        const p = parent[index] ?? -1;
        if (p < 0) continue;
        edges.push({
            id: `edge-${index}-${p}`,
            sourceId: `node-${index}`,
            targetId: `node-${p}`,
            label: "report",
            state: index === signalFrom ? "path" : "idle",
            directed: true,
        });
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { parent?: number[]; busy?: number[]; workTicks?: number } | null) ?? {};
    const rawParent = Array.isArray(task.parent) ? task.parent.map((v) => Math.floor(Number(v))) : [];
    const parent: number[] = rawParent.length > 0 ? rawParent : [-1, 0, 0, 1, 1];
    const n = parent.length;
    const workTicks = Math.max(1, Math.min(8, Math.floor(Number(task.workTicks ?? 2)) || 2));
    const initiallyBusy = Array.isArray(task.busy) ? task.busy.map((v) => Math.floor(Number(v))) : [2, 3, 4];

    const workLeft = Array.from({ length: n }, () => 0);
    const busy = Array.from({ length: n }, () => false);
    const reported = Array.from({ length: n }, () => false);
    for (const index of initiallyBusy) {
        if (index >= 0 && index < n) {
            busy[index] = true;
            workLeft[index] = workTicks;
        }
    }
    const children: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i += 1) {
        const p = parent[i] ?? -1;
        if (p >= 0 && p < n) children[p]!.push(i);
    }

    let signals = 0;
    let terminated = false;
    let signalFrom = -1;
    let step = 0;

    const metaFor = () => ({
        processes: n,
        busy: busy.map((v) => (v ? 1 : 0)),
        reported: reported.map((v) => (v ? 1 : 0)),
        signals,
        signalFrom,
        terminated,
    });

    yield {
        stepNumber: step,
        entities: makeNodes(parent, busy, reported, terminated),
        edges: makeEdges(parent, signalFrom),
        description: `Spanning tree of ${n} process(es); ${busy.filter(Boolean).length} started with work.`,
        codeLineNumber: 0,
        layout: "point",
        meta: metaFor(),
    };
    step += 1;

    let round = 0;
    const maxRounds = n * (workTicks + 3) + 8;
    while (!terminated && round < maxRounds) {
        round += 1;
        signalFrom = -1;

        for (let i = 0; i < n; i += 1) {
            if (!busy[i]) continue;
            workLeft[i] = (workLeft[i] ?? 0) - 1;
            if ((workLeft[i] ?? 0) <= 0) {
                busy[i] = false;
                yield {
                    stepNumber: step,
                    entities: makeNodes(parent, busy, reported, terminated),
                    edges: makeEdges(parent, signalFrom),
                    description: `Process ${i} finished its work and becomes idle, waiting for its children to report.`,
                    codeLineNumber: 2,
                    layout: "point",
                    meta: metaFor(),
                };
                step += 1;
            }
        }

        for (let i = 0; i < n; i += 1) {
            if (busy[i] || reported[i]) continue;
            const kids = children[i] ?? [];
            if (!kids.every((child) => reported[child])) continue;
            const p = parent[i] ?? -1;
            if (p < 0) {
                terminated = true;
                yield {
                    stepNumber: step,
                    entities: makeNodes(parent, busy, reported, terminated),
                    edges: makeEdges(parent, signalFrom),
                    description: `Root ${i} is idle and heard from every child; termination is declared.`,
                    codeLineNumber: 5,
                    layout: "point",
                    meta: metaFor(),
                };
                step += 1;
                break;
            }
            reported[i] = true;
            signals += 1;
            signalFrom = i;
            yield {
                stepNumber: step,
                entities: makeNodes(parent, busy, reported, terminated),
                edges: makeEdges(parent, signalFrom),
                description: `Process ${i} has no busy descendants and reports up to its parent ${p}.`,
                codeLineNumber: 4,
                layout: "point",
                meta: metaFor(),
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeNodes(parent, busy, reported, terminated),
        edges: makeEdges(parent, -1),
        description: terminated
            ? `Termination detected after ${signals} report message(s); every process is idle.`
            : `Stopped before termination; some work or reports were still pending.`,
        codeLineNumber: 6,
        layout: "point",
        meta: metaFor(),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A distributed computation has no global clock, so nobody can simply look around and declare that everything has stopped. Instead, put the processes on a tree and make each one send a single message upward only after it is idle and all of its children have sent theirs. A message reaching a node proves the entire subtree below it is finished. When the root receives the last report, it knows the whole system is quiet.",
        invariants: [
            "A process reports upward at most once.",
            "If a node has reported, every process in its subtree is idle and has reported.",
            "Termination is declared only when the root is idle and all its children have reported.",
        ],
        correctness:
            "By induction on the tree, a report from node i certifies that i is idle and every child subtree is fully reported, hence quiescent. When the root declares termination it is idle and all children have reported, so by the induction every process is idle; therefore the computation really has terminated. The algorithm is also complete: once all work stops, leaves report first, then their parents once their children have reported, and reports propagate to the root in a finite number of rounds.",
        complexityRationale:
            "Each process sends one report and each work item consumes a bounded number of rounds, so detection completes in O(n plus workTicks) rounds. Only a few Boolean flags per process are stored, giving O(n) space plus the tree.",
        uses: [
            "Detecting global quiescence in distributed simulations",
            "Ending distributed graph searches and parallel BFS",
            "Garbage collection and distributed checkpoint coordination",
        ],
        references: [
            "Dijkstra and Scholten, Termination Detection for Diffusing Computations, 1980",
            "Lynch, Distributed Algorithms, Chapter 7",
        ],
        workedExample:
            "A root with two children, one of which has two leaf children. The leaves finish and report to their parent; that parent reports to the root; the other child reports directly. Once the root is idle and has all three reports, it declares termination. Exactly four report messages were sent for five processes.",
    },
    id: "dijkstra-scholten",
    name: "Dijkstra-Scholten Termination Detection",
    category: "parallel-distributed",
    complexity: { time: "O(n + workTicks)", space: "O(n)" },
    defaultInput: { parent: [-1, 0, 0, 1, 1], busy: [2, 3, 4], workTicks: 2 },
    visualType: "point",
    run,
    pseudocode: [
        "overlay a rooted spanning tree on the processes",
        "each busy process performs its work and then becomes idle",
        "an idle process waits until all its children have reported",
        "once all children reported the process sends one report to its parent",
        "a leaf reports as soon as its own work is done",
        "the root declares termination when idle with all children reported",
        "propagate reports until the root decides",
        "done: report termination and the message count",
    ],
};

export default module;
