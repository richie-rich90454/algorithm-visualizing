/**
 * garbage-collection-incremental.ts - Incremental Tri-color Garbage Collection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Incremental garbage collection paints heap objects white, gray, or black
 * while the program keeps running. White objects are unvisited, gray objects
 * are discovered but not scanned, and black objects are fully scanned. A
 * write barrier regrays a black object whenever a pointer to a white object is
 * stored inside it, which is what keeps the collector correct without ever
 * stopping the whole program for a full mark pass.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) scanning plus one O(1) barrier per pointer write
 *   Space: O(V) for the colors and the gray work list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per object shows its color as a numeric code: 0 white, 1 gray,
 *     2 black.
 *   - The object being scanned or regrayed is highlighted.
 *   - meta tracks the color counts and the number of barrier invocations.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GcInput {
    objects?: number;
    edges?: Array<[number, number]>;
    roots?: number[];
    writes?: Array<[number, number]>;
    steps?: number;
}

export type Color = 0 | 1 | 2;

export interface GcResult {
    colors: Color[];
    barriers: number;
    scanned: number;
    trace: Array<{ colors: Color[]; barriers: number; active: number }>;
}

/** Compute the objects reachable from the roots by a plain breadth-first walk. */
export function reachable(objects: number, edges: Array<[number, number]>, roots: number[]): Set<number> {
    const adjacency: number[][] = Array.from({ length: objects }, () => []);
    for (const [from, to] of edges) {
        adjacency[from]?.push(to);
    }
    const seen = new Set<number>();
    const queue = [...roots];
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined || seen.has(current)) continue;
        seen.add(current);
        for (const next of adjacency[current] ?? []) queue.push(next);
    }
    return seen;
}

/** Run the incremental collector with a fixed number of scan steps. */
export function collect(input: GcInput): GcResult {
    const objects = Math.max(0, Math.floor(input.objects ?? 6));
    const edges = input.edges ?? [[0, 1], [1, 2], [3, 4], [0, 3]];
    const roots = input.roots ?? [0];
    const writes = input.writes ?? [];
    const steps = Math.max(0, Math.floor(input.steps ?? 6));
    const colors: Color[] = Array.from({ length: objects }, () => 0);
    const adjacency: number[][] = Array.from({ length: objects }, () => []);
    for (const [from, to] of edges) {
        adjacency[from]?.push(to);
    }
    const gray: number[] = [];
    const trace: GcResult["trace"] = [];
    let barriers = 0;
    let scanned = 0;

    for (const root of roots) {
        if (root >= 0 && root < objects && colors[root] === 0) {
            colors[root] = 1;
            gray.push(root);
        }
    }

    let writeIndex = 0;
    for (let step = 0; step < steps; step += 1) {
        if (writeIndex < writes.length) {
            const [from, to] = writes[writeIndex] ?? [];
            writeIndex += 1;
            if (from !== undefined && to !== undefined && from >= 0 && from < objects && to >= 0 && to < objects) {
                adjacency[from]?.push(to);
                if (colors[from] === 2 && colors[to] === 0) {
                    colors[to] = 1;
                    gray.push(to);
                    barriers += 1;
                }
            }
        }
        const current = gray.shift();
        if (current === undefined) break;
        for (const next of adjacency[current] ?? []) {
            if (colors[next] === 0) {
                colors[next] = 1;
                gray.push(next);
            }
        }
        colors[current] = 2;
        scanned += 1;
        trace.push({ colors: [...colors], barriers, active: current });
    }
    return { colors, barriers, scanned, trace };
}

function makeEntities(result: GcResult, active: number): VisualEntity[] {
    return result.colors.map((color, index) => ({
        id: `object-${index}`,
        type: "bar" as const,
        label: ["white", "gray", "black"][color] ?? "white",
        value: color,
        state: (index === active ? "comparing" : color === 2 ? "sorted" : color === 1 ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, color },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GcInput | null) ?? {};
    const objects = Math.max(0, Math.floor(task.objects ?? 6));
    const result = collect(task);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities({ colors: Array.from({ length: objects }, () => 0), barriers: 0, scanned: 0, trace: [] }, -1),
        edges: [],
        description: `Starting incremental collection over ${objects} object(s): all objects begin white.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { objects, white: objects, gray: 0, black: 0, barriers: 0 },
    };
    step += 1;

    for (let index = 0; index < result.trace.length; index += 1) {
        const snapshot = result.trace[index] ?? { colors: [], barriers: 0, active: 0 };
        yield {
            stepNumber: step,
            entities: makeEntities({ ...result, colors: snapshot.colors }, snapshot.active),
            edges: [],
            description: `Scan step ${index + 1}: object ${snapshot.active} was scanned and painted black; ${snapshot.barriers} write barrier(s) fired so far.`,
            codeLineNumber: 5,
            layout: "array",
            meta: {
                objects,
                white: snapshot.colors.filter((c) => c === 0).length,
                gray: snapshot.colors.filter((c) => c === 1).length,
                black: snapshot.colors.filter((c) => c === 2).length,
                barriers: snapshot.barriers,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(result, -1),
        edges: [],
        description: `Collection complete: ${result.scanned} object(s) scanned, ${result.barriers} write barrier(s) fired.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            objects,
            white: result.colors.filter((c) => c === 0).length,
            gray: result.colors.filter((c) => c === 1).length,
            black: result.colors.filter((c) => c === 2).length,
            barriers: result.barriers,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than freeze the program while the whole heap is marked, an incremental collector does a little marking between program steps. Colors track progress: white is untouched, gray is queued for scanning, and black is done. A write barrier catches the one dangerous case, a black object gaining a pointer to a white one, and puts the white object back on the work list.",
        invariants: [
            "A black object never points to a white object: the write barrier regrays either the target or the source.",
            "Every gray object is present in the work list until it is scanned.",
            "An object reaches black only after all of its outgoing pointers have been examined.",
        ],
        correctness:
            "Starting from the roots, the work list ensures every reachable object is eventually discovered. The only way an already-scanned black object can gain a new white target is a pointer write, and the barrier immediately grays that target, so no reachable object is left white at the end. Unreachable objects stay white and can be reclaimed.",
        complexityRationale:
            "Scanning each object once over all of its outgoing edges costs O(V + E) total, while each pointer write spends O(1) in the barrier. The color array and the gray work list use O(V) space.",
        uses: [
            "Garbage collectors that must keep pause times short, such as incremental and concurrent collectors",
            "Managed runtimes for interactive applications and games",
            "Real-time systems where a stop-the-world mark pass is unacceptable",
        ],
        references: [
            "E. W. Dijkstra, L. Lamport, A. J. Martin, C. S. Scholten, and A. F. M. Steffens, On-the-fly Garbage Collection, 1978",
            "R. Jones, A. Hosking, and J. Moss, The Garbage Collection Handbook, 2nd edition",
        ],
        workedExample:
            "With objects 0 through 3, a root at 0, and edges 0->1 and 1->2, the collector grays 0, then blacks 0 and grays 1, then blacks 1 and grays 2. If the program writes a pointer from black object 0 to white object 3 before 3 is scanned, the barrier grays 3 so it survives the collection.",
    },
    id: "garbage-collection-incremental",
    name: "Incremental Tri-color Garbage Collection",
    category: "production-systems",
    complexity: { time: "O(V + E)", space: "O(V)" },
    defaultInput: { objects: 6, edges: [[0, 1], [1, 2], [3, 4], [0, 3]], roots: [0], writes: [[1, 5]], steps: 6 },
    visualType: "array",
    run,
    pseudocode: [
        "paint every object white and push the roots onto a gray work list",
        "while the work list is not empty",
        "run one program write, regraying any white target of a black object",
        "pop a gray object and scan its outgoing pointers",
        "paint each white child gray and push it onto the work list",
        "paint the scanned object black",
        "done: white objects are garbage and can be reclaimed",
    ],
};

export default module;
