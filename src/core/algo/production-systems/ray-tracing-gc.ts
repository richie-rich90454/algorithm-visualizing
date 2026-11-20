/**
 * ray-tracing-gc.ts - Ray Tracing Garbage Collection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ray tracing garbage collection keeps a reference count for every object.
 * An object whose count reaches zero is certainly unreachable, so it is placed
 * in the ray set. Processing a ray removes each outgoing reference from that
 * object, which can drop another count to zero and add a new ray. The process
 * repeats until the ray set is empty; every object that was rayed is garbage
 * and everything else survives. This is a teaching simulation: like all pure
 * reference counting, an isolated cycle with no external reference is retained
 * because nothing ever lowers its count to zero.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) for V objects and E references
 *   Space: O(V) for counts, the ray set and the survivor set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One node per object; directed edges are the object references.
 *   - A node currently in the ray set is active, a collected node is visited.
 *   - meta carries reference counts, the collected set and the survivors.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface GcInput {
    objects?: number[][];
    roots?: number[];
}

/** Deep-copy the adjacency lists and clamp every reference to a valid index. */
function normalize(raw: number[][]): number[][] {
    return raw.map((list) => [...new Set((list ?? []).map((v) => Math.floor(Number(v) || 0)))].filter((v) => v >= 0 && v < raw.length));
}

/** Initial reference count: incoming object edges plus root references. */
function initialCounts(objects: number[][], roots: number[]): number[] {
    const counts = new Array<number>(objects.length).fill(0);
    for (const list of objects) {
        for (const child of list) counts[child] = (counts[child] ?? 0) + 1;
    }
    for (const root of roots) counts[root] = (counts[root] ?? 0) + 1;
    return counts;
}

/** Independent reachability from the roots, used as the verdict in the frames. */
function reachable(objects: number[][], roots: number[]): Set<number> {
    const seen = new Set<number>();
    const stack = roots.filter((r) => r >= 0 && r < objects.length);
    while (stack.length > 0) {
        const node = stack.pop()!;
        if (seen.has(node)) continue;
        seen.add(node);
        for (const child of objects[node] ?? []) stack.push(child);
    }
    return seen;
}

/** Build node and edge entities for the current collection state. */
function makeGraph(
    objects: number[][],
    counts: number[],
    ray: number[],
    collected: Set<number>,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = objects.map((list, i) => {
        let state: EntityState = "sorted";
        if (collected.has(i)) state = "visited";
        if (ray.includes(i)) state = "active";
        return {
            id: `node-${i}`,
            type: "node" as const,
            label: `O${i}:rc${counts[i] ?? 0}`,
            value: counts[i] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, refCount: counts[i] ?? 0, childCount: list.length },
        };
    });
    const edges: VisualEdge[] = [];
    objects.forEach((list, i) => {
        list.forEach((child) => {
            edges.push({
                id: `edge-${i}-${child}`,
                sourceId: `node-${i}`,
                targetId: `node-${child}`,
                label: "ref",
                state: collected.has(i) ? "visited" : "idle",
                directed: true,
            });
        });
    });
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GcInput | null) ?? {};
    const raw = Array.isArray(task.objects) && task.objects.length > 0
        ? task.objects.map((list) => (Array.isArray(list) ? list : []))
        : [[1, 2], [3], [3], [], [5], [], []];
    const objects = normalize(raw);
    const roots = (Array.isArray(task.roots) ? task.roots : [0, 4])
        .map((r) => Math.floor(Number(r) || 0))
        .filter((r) => r >= 0 && r < objects.length);
    const counts = initialCounts(objects, roots);
    const ray: number[] = [];
    const collected = new Set<number>();
    let step = 0;
    const emit = (description: string, codeLine: number, extra: Record<string, unknown>) => ({
        stepNumber: step++,
        ...makeGraph(objects, counts, ray, collected),
        description,
        codeLineNumber: codeLine,
        layout: "graph" as const,
        meta: {
            count: objects.length,
            roots: roots.slice(),
            counts: counts.slice(),
            ray: ray.slice(),
            collected: [...collected].sort((a, b) => a - b),
            ...extra,
        },
    });

    yield emit(`Starting ray tracing GC with ${objects.length} object(s) and ${roots.length} root(s).`, 0, { phase: "init" });

    for (let i = 0; i < objects.length; i += 1) {
        if ((counts[i] ?? 0) === 0) ray.push(i);
    }
    yield emit(`Initial rays: ${ray.length} object(s) have a zero reference count.`, 2, { phase: "rays" });

    while (ray.length > 0) {
        const current = ray.shift()!;
        if (collected.has(current)) continue;
        collected.add(current);
        yield emit(`Ray reaches object ${current}; removing its outgoing references.`, 4, { phase: "trace", current });

        for (const child of objects[current] ?? []) {
            counts[child] = Math.max(0, (counts[child] ?? 0) - 1);
            if ((counts[child] ?? 0) === 0 && !collected.has(child) && !ray.includes(child)) {
                ray.push(child);
            }
        }
        yield emit(`Released references of object ${current}; ray set is now [${ray.join(", ")}].`, 6, { phase: "release", current });
    }

    const survivors = objects.map((_list, i) => i).filter((i) => !collected.has(i));
    const trueLive = reachable(objects, roots);
    const expected = [...trueLive].sort((a, b) => a - b);
    const correct = survivors.length === expected.length && survivors.every((id, i) => id === expected[i]);
    yield emit(
        correct
            ? `Correct: ${survivors.length} object(s) survive and ${collected.size} unreachable object(s) were collected.`
            : `Reference counting retained ${survivors.length - expected.length} isolated cycle object(s) it cannot reclaim.`,
        8,
        { phase: "done", survivors, reachable: expected, correct: correct ? 1 : 0 },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Give every object a count of how many references point at it. Roots and other objects contribute to that count. When the count falls to zero the object cannot be reached, so shoot a ray at it: follow each of its references and subtract one from those objects' counts. Any count that becomes zero creates another ray. When no rays remain, the objects you traced are garbage and the rest are alive.",
        invariants: [
            "An object enters the ray set only when its reference count is zero.",
            "Each outgoing reference of a rayed object is released exactly once.",
            "An object reachable from a root always keeps a count of at least one.",
        ],
        correctness:
            "A zero count means no root and no other object points at the object, so it is unreachable and safe to collect. Releasing its outgoing edges models deleting the object: any child that loses its last reference is likewise unreachable and is rayed in turn. By induction every object in the ray set is unreachable, and a root-reachable object always retains the chain of counts from the root, so it is never rayed. For graphs without isolated cycles the collected set is exactly the complement of the root-reachable set.",
        complexityRationale:
            "Each object enters the ray set at most once and each reference is released once when its owner is rayed, so the work is O(V + E). The counts, ray set and survivor set each hold at most one entry per object, giving O(V) space.",
        uses: [
            "Teaching the bridge between reference counting and tracing collectors",
            "Incremental reclamation where counts are maintained at runtime",
            "Explaining why reference counting alone leaks reference cycles",
        ],
        references: [
            "Deutsch and Bobrow, An Efficient, Incremental, Automatic Garbage Collector, 1976",
            "Jones, Lins, and Somani, Garbage Collection: Algorithms for Automatic Dynamic Memory Management",
        ],
        workedExample:
            "Objects 0 and 4 are roots; 0 points to 1 and 2, both of which point to 3. Object 5 is pointed to only by 4. If object 4's root reference is removed in a different trace, 5 reaches zero, is rayed and collected. Object 3 survives because 1 and 2 still hold references from root 0. An isolated pair of objects that reference only each other would keep counts of one and would be retained, illustrating the cycle limitation.",
    },
    id: "ray-tracing-gc",
    name: "Ray Tracing Garbage Collection",
    category: "production-systems",
    complexity: { time: "O(V + E)", space: "O(V)" },
    defaultInput: {
        objects: [[1, 2], [3], [3], [], [5], [], []],
        roots: [0, 4],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "count incoming references from objects and roots",
        "place every object with a zero count in the ray set",
        "while the ray set is not empty",
        "remove one object and mark it collected",
        "for each reference it held, decrement the target count",
        "if a target count reaches zero, add it to the ray set",
        "after the ray set is empty, list the survivors",
        "compare survivors with true reachability from the roots",
        "done: report collected and surviving objects",
    ],
};

export default module;
