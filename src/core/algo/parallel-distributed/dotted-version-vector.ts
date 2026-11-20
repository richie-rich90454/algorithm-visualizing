/**
 * dotted-version-vector.ts - Dotted Version Vector Merge
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A dotted version vector records causal history as a compact counter per
 * actor plus a set of outstanding dots. A dot is a unique (actor, counter)
 * pair produced by one update. Counters that form an unbroken prefix are
 * compressed into the vector; anything beyond a gap stays as an explicit dot.
 * Merging two vectors unions their dots and then recompresses. The result is
 * commutative, associative, and idempotent, so replicas that receive the same
 * updates in different orders converge to the same state.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(a * d) to merge a actors with at most d dots each
 *   Space: O(a + d) for the compressed vector and the dot set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Rows are actors; columns are update counters.
 *   - Compressed counters are green, explicit dots are yellow, absent cells idle.
 *   - Frames show each replica, then the raw union, then the merged vector.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Replica {
    actor: string;
    counters: number[];
}

type History = Record<string, number[]>;

const DEFAULT_REPLICAS: Replica[] = [
    { actor: "A", counters: [1, 2, 3] },
    { actor: "B", counters: [1, 2] },
    { actor: "A", counters: [1, 2] },
    { actor: "B", counters: [1, 2, 3] },
];

function normalizeReplicas(replicas: Replica[]): History[] {
    return replicas.map((replica) => {
        const actor = typeof replica?.actor === "string" && replica.actor.length > 0 ? replica.actor : "unknown";
        const counters = Array.isArray(replica?.counters)
            ? replica.counters.filter((c) => Number.isInteger(c) && c >= 1 && c <= 16).map((c) => c as number)
            : [];
        return { [actor]: [...new Set(counters)].sort((a, b) => a - b) };
    });
}

/** Compress a counter set into a contiguous version vector plus explicit dots. */
function compress(counters: number[]): { version: number; dots: number[] } {
    const present = new Set(counters);
    let version = 0;
    while (present.has(version + 1)) version += 1;
    const dots = counters.filter((c) => c > version).sort((a, b) => a - b);
    return { version, dots };
}

function merge(a: History, b: History): History {
    const actors = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    const result: History = {};
    for (const actor of actors) {
        result[actor] = [...new Set([...(a[actor] ?? []), ...(b[actor] ?? [])])].sort((x, y) => x - y);
    }
    return result;
}

function equal(a: History, b: History): boolean {
    const actors = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return actors.every((actor) => {
        const left = a[actor] ?? [];
        const right = b[actor] ?? [];
        return left.length === right.length && left.every((value, i) => value === right[i]);
    });
}

function makeCells(history: History, actors: string[], maxCounter: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < actors.length; r += 1) {
        const actor = actors[r] ?? "";
        const counters = history[actor] ?? [];
        const { version, dots } = compress(counters);
        for (let c = 1; c <= maxCounter; c += 1) {
            const present = counters.includes(c);
            const isDot = dots.includes(c);
            const state: EntityState = !present ? "idle" : isDot ? "comparing" : "sorted";
            entities.push({
                id: `cell-${r}-${c - 1}`,
                type: "cell",
                label: present ? String(c) : "-",
                value: present ? c : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c - 1, actor, counter: c, version, dot: isDot },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { replicas?: Replica[] } | null) ?? {};
    const raw = Array.isArray(task.replicas) && task.replicas.length >= 2 ? task.replicas : DEFAULT_REPLICAS;
    const replicas = normalizeReplicas(raw).slice(0, 4);
    let union: History = {};
    const actors = [...new Set(replicas.flatMap((r) => Object.keys(r)))].sort();
    const maxCounter = Math.max(1, ...replicas.flatMap((r) => Object.values(r).flat()));
    const describe = (history: History) => actors.map((actor) => {
        const { version, dots } = compress(history[actor] ?? []);
        return `${actor}:${version}${dots.length > 0 ? `+${dots.join(",")}` : ""}`;
    });
    const meta = (stage: string, history: History, done: boolean) => {
        const compressed: Record<string, { version: number; dots: number[] }> = {};
        for (const actor of actors) compressed[actor] = compress(history[actor] ?? []);
        const [a, b, c] = replicas;
        const ab = a && b ? merge(a, b) : {};
        const bc = b && c ? merge(b, c) : {};
        const abc1 = c ? merge(ab, c) : ab;
        const abc2 = a ? merge(a, bc) : bc;
        return {
            actors: [...actors],
            rows: actors.length,
            cols: maxCounter,
            stage,
            descriptions: describe(history),
            versions: actors.map((actor) => compressed[actor]?.version ?? 0),
            dots: actors.map((actor) => (compressed[actor]?.dots ?? []).join(",")),
            commutative: a && b ? equal(ab, merge(b, a)) : true,
            associative: a && b && c ? equal(abc1, abc2) : true,
            idempotent: a ? equal(merge(a, a), a) : true,
            dotCount: actors.reduce((sum, actor) => sum + (compressed[actor]?.dots.length ?? 0), 0),
            done,
        };
    };
    const emit = function* (stage: string, step: number, history: History, done: boolean): Generator<VisualFrame, void, unknown> {
        yield {
            stepNumber: step,
            entities: makeCells(history, actors, maxCounter),
            edges: [],
            description: done
                ? `Merged vector ${describe(history).join(" ")}; merge is commutative, associative, and idempotent.`
                : `${stage}: ${describe(history).join(" ")}.`,
            codeLineNumber: done ? 5 : step === 0 ? 0 : 2,
            layout: "grid",
            meta: meta(stage, history, done),
        };
    };

    let step = 0;
    for (let i = 0; i < replicas.length; i += 1) {
        yield* emit(`replica ${i + 1}`, step, replicas[i] ?? {}, false);
        step += 1;
    }
    for (const replica of replicas) union = merge(union, replica);
    yield* emit("raw union", step, union, false);
    step += 1;
    yield* emit("merged", step, union, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A version vector answers how many updates a replica has seen from each actor, but it cannot describe concurrent updates that skip a counter. A dotted vector keeps those stragglers as explicit dots. When replicas merge, their dots are pooled and any unbroken run starting at one is folded back into the compact counter, so the same history has one canonical representation.",
        invariants: [
            "A counter is in the compressed prefix only if every smaller counter for that actor is also present.",
            "Every dot is a real update that is not yet part of the contiguous prefix.",
            "Merging never loses a dot: the union of counters is preserved exactly.",
        ],
        correctness:
            "Merge is set union per actor followed by deterministic compression, and set union is commutative, associative, and idempotent, so those laws carry over to the vector representation because compression is a function of the set alone. The compression loop advances while the next counter is present, so the stored version is the longest prefix starting at one and all remaining counters are dots. Because two replicas with the same update set always produce the same version and dot set, they converge regardless of delivery order.",
        complexityRationale:
            "For a actors with at most d counters each, merging takes linear time in the total number of dots, O(a times d). Storing the versions and dots uses O(a + d) space.",
        uses: [
            "Causal consistency in distributed key-value stores such as Riak",
            "Detecting concurrent writes without false conflicts",
            "Conflict-free replicated data type metadata",
        ],
        references: [
            "Preguica, Shapiro, and Baquero, Dotted Version Vectors, 2010",
            "Baquero, Preguica, and Shapiro, A Conflict-Free Replicated JSON Datatype, 2017",
        ],
        workedExample:
            "Replica one holds A counters 1, 2, 3 and replica two holds A counters 1, 2. Their union is A 1, 2, 3, which compresses to version 3 with no dots. If a third replica holds A counters 1 and 3, compression gives version 1 plus the explicit dot 3, and merging it with the others recovers version 3 with no dots.",
    },
    id: "dotted-version-vector",
    name: "Dotted Version Vector",
    category: "parallel-distributed",
    complexity: { time: "O(a * d)", space: "O(a + d)" },
    defaultInput: { replicas: DEFAULT_REPLICAS },
    visualType: "grid",
    run,
    pseudocode: [
        "collect the per-actor update counters from each replica",
        "compress each replica into a prefix version and explicit dots",
        "union the counters of all replicas per actor",
        "recompress the union from counter one upward",
        "advance the prefix while the next counter is present",
        "keep every remaining counter as a dot",
        "done: report the merged vector and its algebraic laws",
    ],
};

export default module;
