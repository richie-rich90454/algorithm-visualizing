/**
 * howard-minimum-cost-to-time-ratio.ts - Minimum Cost-to-Time Ratio Cycle
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A cost-to-time ratio cycle minimizes total cost divided by total time over
 * all closed walks. The algorithm uses Howard's threshold idea: for a trial
 * ratio lambda it evaluates the reduced weights c - lambda*t. A closed walk
 * with negative total reduced weight exists exactly when some cycle beats
 * lambda, so a policy-style negative-cycle test decides which half of the
 * search range to keep. Binary search then converges to the optimal ratio,
 * and a final cycle scan reports the walk that attains it.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log(1/eps) * V * E + E * 2^V) for the search and final cycle
 *   Space: O(V + E) for edges and Bellman-Ford potentials
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Edge labels show cost over time for every arc.
 *   - Edges of the current best cycle turn yellow as the search narrows.
 *   - The final frame reports the optimal ratio and the cycle attaining it.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Arc {
    from: string;
    to: string;
    cost: number;
    time: number;
}

const DEFAULT_GRAPH: Record<string, Array<[string, number, number]>> = {
    A: [["B", 1, 2], ["C", 4, 1]],
    B: [["C", -3, 2], ["A", 2, 1]],
    C: [["A", 1, 1], ["B", 2, 3]],
};

function parseGraph(input: Record<string, Array<[string, number, number]>>): Arc[] {
    const arcs: Arc[] = [];
    for (const [from, targets] of Object.entries(input)) {
        for (const target of targets) {
            if (!Array.isArray(target)) continue;
            arcs.push({
                from,
                to: String(target[0]),
                cost: typeof target[1] === "number" ? target[1] : 0,
                time: typeof target[2] === "number" && target[2] > 0 ? target[2] : 1,
            });
        }
    }
    return arcs;
}

function hasBetterCycle(arcs: Arc[], vertices: string[], lambda: number): boolean {
    const distance = new Map<string, number>();
    for (const vertex of vertices) distance.set(vertex, 0);
    for (let round = 0; round < vertices.length; round += 1) {
        let changed = false;
        for (const arc of arcs) {
            const value = (distance.get(arc.from) ?? 0) + arc.cost - lambda * arc.time;
            if (value < (distance.get(arc.to) ?? 0) - 1e-12) {
                distance.set(arc.to, value);
                changed = true;
            }
        }
        if (!changed) return false;
        if (round === vertices.length - 1) return true;
    }
    return false;
}

function bestCycle(arcs: Arc[], vertices: string[]): { ratio: number; cycle: string[] } {
    const outgoing = new Map<string, Arc[]>();
    for (const vertex of vertices) outgoing.set(vertex, []);
    for (const arc of arcs) outgoing.get(arc.from)?.push(arc);
    let best = Number.POSITIVE_INFINITY;
    let bestPath: string[] = [];
    for (const start of vertices) {
        const visit = (vertex: string, seen: Set<string>, cost: number, time: number, path: string[]): void => {
            for (const arc of outgoing.get(vertex) ?? []) {
                if (arc.to === start) {
                    const ratio = (cost + arc.cost) / (time + arc.time);
                    if (ratio < best) {
                        best = ratio;
                        bestPath = [...path];
                    }
                } else if (!seen.has(arc.to)) {
                    const next = new Set(seen);
                    next.add(arc.to);
                    visit(arc.to, next, cost + arc.cost, time + arc.time, [...path, arc.to]);
                }
            }
        };
        visit(start, new Set([start]), 0, 0, [start]);
    }
    return { ratio: Number.isFinite(best) ? best : 0, cycle: bestPath };
}

function buildEntities(
    vertices: string[],
    arcs: Arc[],
    cycle: string[],
): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const cycleEdges = new Set<string>();
    for (let i = 0; i < cycle.length; i += 1) {
        cycleEdges.add(`${cycle[i]}->${cycle[(i + 1) % cycle.length]}`);
    }
    const nodes = vertices.map((label) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: (cycle.includes(label) ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label },
    }));
    const edges = arcs.map((arc) => ({
        id: `edge-${arc.from}-${arc.to}`,
        sourceId: `node-${arc.from}`,
        targetId: `node-${arc.to}`,
        label: `${arc.cost}/${arc.time}`,
        state: (cycleEdges.has(`${arc.from}->${arc.to}`) ? "comparing" : "idle") as EntityState,
        directed: true,
    }));
    return { nodes, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, Array<[string, number, number]>> } | null) ?? {};
    const arcs = parseGraph(task.graph ?? DEFAULT_GRAPH);
    const vertices = [...new Set([...Object.keys(task.graph ?? DEFAULT_GRAPH), ...arcs.map((a) => a.to)])];
    let step = 0;

    const emit = (description: string, line: number, cycle: string[], low: number, high: number, ratio: number): VisualFrame => {
        const built = buildEntities(vertices, arcs, cycle);
        return {
            stepNumber: step,
            entities: built.nodes,
            edges: built.edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: { ratio, low, high, vertices: vertices.length, cycle: [...cycle] },
        };
    };

    if (vertices.length === 0 || arcs.length === 0) {
        yield emit("Empty graph - there is no cycle and no ratio to compute.", 0, [], 0, 0, 0);
        return;
    }

    let low = Math.min(...arcs.map((arc) => arc.cost / arc.time));
    let high = Math.max(...arcs.map((arc) => arc.cost / arc.time));
    yield emit(`Search ratios between ${low.toFixed(3)} and ${high.toFixed(3)} using reduced weights.`, 0, [], low, high, low);
    step += 1;

    for (let iteration = 0; iteration < 60; iteration += 1) {
        const mid = (low + high) / 2;
        const better = hasBetterCycle(arcs, vertices, mid);
        if (better) high = mid;
        else low = mid;
        if (step < 200) {
            yield emit(
                `Trial lambda ${mid.toFixed(4)}: ${better ? "a negative reduced-cost cycle exists, so the optimum is lower" : "no cycle beats lambda, so the optimum is higher"}.`,
                better ? 3 : 4,
                bestCycle(arcs, vertices).cycle,
                low,
                high,
                mid,
            );
            step += 1;
        }
        if (high - low < 1e-10) break;
    }

    const optimum = bestCycle(arcs, vertices);
    yield emit(
        `Done: minimum cost-to-time ratio ${optimum.ratio.toFixed(4)} on cycle ${optimum.cycle.join(" -> ") || "none"}.`,
        7,
        optimum.cycle,
        low,
        high,
        optimum.ratio,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Comparing two cycle ratios is the same as asking whether a transformed edge cost is negative on average. For a trial ratio lambda, replace every arc weight by cost minus lambda times time. If a closed walk has negative total transformed weight, it beats lambda; otherwise lambda is a lower bound. Repeatedly halving the interval brackets the best ratio, and one final cycle scan names a witness.",
        invariants: [
            "Every cycle ratio lies between the smallest and largest single-arc cost-to-time ratios.",
            "A negative reduced-cost cycle exists exactly when some cycle ratio is below the trial value.",
            "The search interval always brackets the optimum and strictly shrinks each round.",
        ],
        correctness:
            "For a cycle with cost C and time T, the sum of reduced weights is C - lambda*T, which is negative exactly when C/T < lambda because T is positive. Bellman-Ford detects such a cycle precisely, so each threshold test is exact. Binary search therefore converges to the true minimum ratio, and enumerating simple cycles at the end returns a cycle attaining it.",
        complexityRationale:
            "Each threshold test runs Bellman-Ford in O(VE), and a fixed number of rounds gives a machine-precision answer, so the search is O(log(1/eps)*V*E). The final witness scan is exponential only in the small classroom graphs.",
        uses: [
            "Finding the most profitable repeating route in a network",
            "Cycle-ratio constraints in scheduling and network calculus",
            "Minimum mean-weight cycle detection as a special case",
        ],
        references: [
            "Lawler, Combinatorial Optimization: Networks and Matroids, ratio-cycle chapter",
            "Karp, A Characterization of the Minimum Cycle Mean (1978)",
        ],
        workedExample:
            "On the default graph the cycle A->B->C->A has cost 1 + -3 + 1 = -1 and time 2 + 2 + 1 = 5, giving ratio -0.2. Threshold tests below and above -0.2 disagree in the expected direction, so the bracket collapses to -0.2 and that cycle is reported.",
    },
    id: "howard-minimum-cost-to-time-ratio",
    name: "Howard Minimum Cost-to-Time Ratio Cycle",
    category: "shortest-path",
    complexity: { time: "O(log(1/eps) * V * E)", space: "O(V + E)" },
    defaultInput: { graph: DEFAULT_GRAPH },
    visualType: "graph",
    run,
    pseudocode: [
        "set the search bracket from the smallest and largest arc ratios",
        "pick the midpoint lambda of the bracket",
        "replace each arc weight by cost minus lambda times time",
        "test for a negative-weight closed walk with Bellman-Ford",
        "if one exists, move the upper bound down to lambda",
        "otherwise move the lower bound up to lambda",
        "repeat until the bracket is smaller than the tolerance",
        "done: scan cycles and report the optimum and its witness",
    ],
};

export default module;
