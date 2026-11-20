/**
 * version-tree.ts - Version Tree (Persistent Key-Value Structure)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A version tree keeps every historical state of a persistent map. Each
 * update forks a new version from any existing one and records a single key
 * change; past versions stay readable forever. A query walks from the chosen
 * version back through its ancestors and reports the most recent assignment
 * to the requested key on that path.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per update, O(d) per query on a version of depth d
 *   Space: O(n) for n recorded versions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node is a version, labeled with its number.
 *   - A newly forked version is YELLOW (comparing).
 *   - The ancestor path read by a query is BLUE (active);
 *     the node supplying the answer is GREEN or RED when absent.
 */
import type { AlgorithmModule, EntityState, MetaValue, VisualEntity, VisualFrame } from "@/types";

type Change = { key: string; value: number };

function makeNodes(
    count: number,
    parentOf: number[],
    highlight: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < count; i += 1) {
        entities.push({
            id: `ver-${i}`,
            type: "node" as const,
            label: `v${i}`,
            value: i,
            state: highlight.get(i) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: i === 0 ? "root" : `ver-${parentOf[i] ?? 0}`, version: i },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    type Update = { key: string; value: number; parent?: number };
    const task = (input as {
        updates?: Update[];
        queries?: { version: number; key: string }[];
    } | null) ?? {};
    const updates: Update[] = Array.isArray(task.updates)
        ? task.updates
        : [
              { key: "a", value: 1 },
              { key: "b", value: 2, parent: 0 },
              { key: "a", value: 9, parent: 1 },
          ];
    const queries: { version: number; key: string }[] = Array.isArray(task.queries)
        ? task.queries
        : [
              { version: 1, key: "a" },
              { version: 2, key: "a" },
              { version: 3, key: "a" },
          ];

    const parentOf: number[] = [-1];
    const changes: (Change | null)[] = [null];
    let step = 0;

    const snap = (
        description: string,
        codeLineNumber: number,
        highlight: Map<number, EntityState>,
        meta: Record<string, MetaValue>,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeNodes(parentOf.length, parentOf, highlight),
        edges: [],
        description,
        codeLineNumber,
        layout: "tree",
        meta,
    });

    yield snap("Version 0 is the empty root; every update forks a new version.", 0, new Map(), {
        versions: 1,
    });
    step += 1;

    for (let i = 1; i <= updates.length; i += 1) {
        const update = updates[i - 1];
        if (!update) continue;
        const requested = typeof update.parent === "number" ? Math.floor(update.parent) : 0;
        const parent = Math.max(0, Math.min(i - 1, requested));
        parentOf[i] = parent;
        changes[i] = { key: String(update.key), value: Number(update.value) };
        yield snap(
            `Version ${i} forks from v${parent} and sets ${update.key} to ${update.value}.`,
            2,
            new Map([[i, "comparing"]]),
            { versions: parentOf.length, forkedFrom: parent, key: update.key, value: update.value },
        );
        step += 1;
    }

    const lookup = (version: number, key: string): { found: boolean; value: number; path: number[] } => {
        const path: number[] = [];
        let current = Math.max(0, Math.min(parentOf.length - 1, Math.floor(version)));
        while (current >= 0) {
            path.push(current);
            const change = changes[current];
            if (current >= 1 && change && change.key === key) {
                return { found: true, value: change.value, path };
            }
            current = parentOf[current] ?? -1;
        }
        return { found: false, value: 0, path };
    };

    const results: Record<string, number | null> = {};
    for (const query of queries) {
        const { found, value, path } = lookup(query.version, query.key);
        results[`${query.version}:${query.key}`] = found ? value : null;
        const highlight = new Map<number, EntityState>();
        for (const id of path) highlight.set(id, "active");
        const terminal = path[path.length - 1];
        if (terminal !== undefined) highlight.set(terminal, found ? "sorted" : "error");
        yield snap(
            `Query v${query.version} for ${query.key}: ${found ? `value ${value}` : "absent"} along ${path.length} version(s).`,
            4,
            highlight,
            { version: query.version, key: query.key, found, value: found ? value : null },
        );
        step += 1;
    }

    yield snap(`Done: ${parentOf.length} versions stored and ${queries.length} queries answered.`, 6, new Map(), {
        results,
        versions: parentOf.length,
        queries: queries.length,
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of copying a whole map for every change, a version tree records just one change per new version and points back to the version it forked from. Because the parent pointer is explicit, branches are free: two versions can diverge from the same ancestor and each keeps its own history. Reading a key follows the fork chain until the newest matching change is found.",
        invariants: [
            "Version 0 is the empty root with no assignments.",
            "Each version after the root has exactly one parent and one key change.",
            "A query returns the nearest matching change on its ancestor path.",
        ],
        correctness:
            "Every assignment ever made lives in exactly one version record. The ancestor path of a version is precisely the sequence of updates that produced it, ordered newest first, so the first record whose key matches is the most recent value visible in that version. If no record matches, the key was never assigned on that path, which is the correct absent answer.",
        complexityRationale:
            "Forking allocates one constant-size record, so an update is O(1). A query walks at most the depth of the version tree, O(d) time. Storing n versions uses O(n) records; full snapshots would cost O(n times map size).",
        uses: [
            "Persistent maps in functional languages",
            "Database snapshot and time-travel queries",
            "Undo and branching in editors and version-control models",
        ],
        references: [
            "Okasaki, Purely Functional Data Structures, persistence chapter",
            "Driscoll, Sleator, and Tarjan, Making Data Structures Persistent, 1986",
        ],
        workedExample:
            "Version 0 is empty. v1 sets a=1 from v0, v2 sets b=2 from v0, and v3 sets a=9 from v1. Querying v3 for a walks v3 then v1 and returns 9 from v3. Querying v2 for a walks v2 then v0, finds no change to a, and reports absent because v2 branched before a was overwritten on the other branch.",
    },
    id: "version-tree",
    name: "Version Tree (Persistent Map)",
    category: "data-structures",
    complexity: { time: "O(1) update, O(d) query", space: "O(n)" },
    defaultInput: {
        updates: [
            { key: "a", value: 1 },
            { key: "b", value: 2, parent: 0 },
            { key: "a", value: 9, parent: 1 },
        ],
        queries: [
            { version: 1, key: "a" },
            { version: 2, key: "a" },
            { version: 3, key: "a" },
        ],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "create version 0 as the empty root",
        "for each update choose its parent version",
        "append a new version storing one key and value",
        "for a query start at the requested version",
        "walk up the parent chain toward the root",
        "return the first matching change, or absent at the root",
        "done: report every query value",
    ],
};

export default module;
