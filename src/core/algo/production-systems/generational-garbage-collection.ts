/**
 * generational-garbage-collection.ts - Generational Garbage Collection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Generational collectors exploit the observation that most objects die young.
 * Objects start in the young generation. A minor collection traces from roots
 * plus all old objects, promotes surviving young objects to old, and reclaims
 * the rest. An occasional major collection traces the whole heap and reclaims
 * unreachable old objects too.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) per collection
 *   Space: O(V) for the mark set and traversal stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per object shows its id and current generation.
 *   - Blue is promoted, green is kept, red is reclaimed, yellow is being checked.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    objects?: string[];
    generations?: number[];
    refs?: Record<string, string[]>;
    roots?: string[];
}

type Status = "unvisited" | "checking" | "kept" | "promoted" | "collected";

/** Build one cell per object with its generation and collection status. */
function makeCells(
    objects: string[],
    generations: number[],
    status: Map<string, Status>,
): VisualEntity[] {
    return objects.map((id, index) => {
        const current = status.get(id) ?? "unvisited";
        const state: EntityState = current === "kept" ? "sorted"
            : current === "promoted" ? "active"
            : current === "collected" ? "error"
            : current === "checking" ? "comparing"
            : "unvisited";
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${id} (g${generations[index] ?? 0})`,
            value: generations[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: index, col: 0, object: id, generation: generations[index] ?? 0 },
        };
    });
}

/** Reachability over the set of currently live objects. */
function traceFrom(
    seeds: string[],
    refs: Record<string, string[]>,
    alive: Set<string>,
): Set<string> {
    const seen = new Set<string>();
    const stack = seeds.filter((id) => alive.has(id));
    while (stack.length > 0) {
        const id = stack.pop();
        if (id === undefined || seen.has(id)) continue;
        seen.add(id);
        for (const next of refs[id] ?? []) {
            if (alive.has(next) && !seen.has(next)) stack.push(next);
        }
    }
    return seen;
}

/** The generational collector generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const objects = Array.isArray(task.objects) && task.objects.length > 0
        ? task.objects.slice()
        : ["A", "B", "C", "D", "E", "F", "G"];
    const generations = objects.map((_, i) => (task.generations?.[i] === 1 ? 1 : 0));
    const refs: Record<string, string[]> = task.refs && typeof task.refs === "object"
        ? task.refs
        : { A: ["B"], B: ["C"], C: [], D: ["E"], E: [], F: ["G"], G: [] };
    const roots = Array.isArray(task.roots) ? task.roots.slice() : ["A"];
    const status = new Map<string, Status>(objects.map((id) => [id, "unvisited"]));
    const alive = new Set(objects);
    const collected: string[] = [];

    const summary = (phase: string) => ({
        rows: objects.length,
        cols: 1,
        phase,
        generations: objects.map((id) => (alive.has(id) ? (generations[objects.indexOf(id)] ?? 0) : -1)),
        collected: collected.slice(),
        aliveCount: alive.size,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(objects, generations, status),
        edges: [],
        description: `Generational collector: ${objects.length} objects, roots ${roots.join(", ")}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: summary("initial"),
    };
    let step = 1;

    // Minor collection: treat old objects as extra roots, collect unreachable young.
    const oldObjects = objects.filter((id) => alive.has(id) && generations[objects.indexOf(id)] === 1);
    const minorSeen = traceFrom([...roots, ...oldObjects], refs, alive);
    const young = objects.filter((id) => alive.has(id) && generations[objects.indexOf(id)] === 0);
    for (const id of young) {
        status.set(id, "checking");
        yield {
            stepNumber: step,
            entities: makeCells(objects, generations, status),
            edges: [],
            description: `Minor collection: checking young object ${id}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: summary("minor"),
        };
        step += 1;
        if (minorSeen.has(id)) {
            status.set(id, "promoted");
            generations[objects.indexOf(id)] = 1;
        } else {
            status.set(id, "collected");
            alive.delete(id);
            collected.push(id);
        }
    }

    // Major collection: trace the whole surviving heap from the roots.
    const majorSeen = traceFrom(roots, refs, alive);
    const oldSurvivors = objects.filter((id) => alive.has(id));
    for (const id of oldSurvivors) {
        status.set(id, "checking");
        yield {
            stepNumber: step,
            entities: makeCells(objects, generations, status),
            edges: [],
            description: `Major collection: checking object ${id}.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: summary("major"),
        };
        step += 1;
        if (majorSeen.has(id)) {
            status.set(id, "kept");
        } else {
            status.set(id, "collected");
            alive.delete(id);
            collected.push(id);
        }
    }

    const final = summary("done");
    yield {
        stepNumber: step,
        entities: makeCells(objects, generations, status),
        edges: [],
        description: `Collection complete: ${collected.length} reclaimed, ${alive.size} alive.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: final,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Most objects stop being useful soon after they are created, so it pays to look at young objects often and old objects rarely. A minor pass checks only the nursery, using old objects as additional roots because they may still point into it. Survivors graduate to the old generation, and only an occasional full pass bothers to examine them.",
        invariants: [
            "Young objects are examined only during the minor phase.",
            "Every young survivor is promoted before the major phase begins.",
            "An object is reclaimed only when no root or live object can reach it.",
        ],
        correctness:
            "Treating old objects as roots during a minor pass is sound because every live old object is reachable from the real roots and any reference it holds into the young generation must keep that target alive. Tracing from those seeds therefore finds exactly the live young objects; the rest are unreachable. The major pass traces the entire surviving heap from the true roots, so any object it does not see is genuinely dead. Because each pass collects only unreachable objects, no live object is freed.",
        complexityRationale:
            "Each collection traces at most V objects and E references once and then scans the objects being examined once, giving O(V+E) time per pass. The traversal structures hold at most V objects, so space is O(V).",
        uses: [
            "The young and old heaps in the Java virtual machine",
            "Generational collectors in V8 and .NET runtimes",
            "Reducing pause times in large server heaps",
        ],
        references: [
            "Ungar, Generation Scavenging: A Non-Disruptive High Performance Storage Reclamation Algorithm, 1984",
            "Jones, Hosking, and Moss, The Garbage Collection Handbook, Chapter 3",
        ],
        workedExample:
            "With young objects A, B and old object C, root A, and edges A to B and C to B, a minor pass starts from A and C and keeps both young objects, promoting them. If old object D has no path from a root, the later major pass reclaims it.",
    },
    id: "generational-garbage-collection",
    name: "Generational Garbage Collection",
    category: "production-systems",
    complexity: { time: "O(V+E)", space: "O(V)" },
    defaultInput: {
        objects: ["A", "B", "C", "D", "E", "F", "G"],
        generations: [0, 0, 0, 1, 1, 0, 0],
        refs: { A: ["B"], B: ["C"], C: [], D: ["E"], E: [], F: ["G"], G: [] },
        roots: ["A"],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "partition objects into young and old generations",
        "minor: trace from roots plus all old objects",
        "for each young object",
        "promote it when reached, otherwise reclaim it",
        "major: trace the surviving heap from the roots",
        "for each remaining object",
        "keep it when reached, otherwise reclaim it",
        "done: report final generations and reclaimed objects",
    ],
};

export default module;
