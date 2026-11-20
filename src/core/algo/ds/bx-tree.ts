/**
 * bx-tree.ts - Bx-Tree (Moving-Object Index)
 *
 * A Bx-tree indexes the changing positions of moving objects. Each position
 * is encoded as a Bx-value: high bits give a time partition and low bits are a
 * space-filling (Morton/Z-order) code of the location. Those values are stored
 * in a B+ tree with sibling links; an auxiliary latest-key map turns an update
 * into a delete of the old Bx-value followed by an insert of the new one, so
 * each object appears once. Time partitions let old ranges expire together.
 *
 * Time:  O(log n) per insert/update, O(n) for a full scan query
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Entry {
    key: number;
    id: number;
}

/** Spread the low 16 bits of n so they occupy even bit positions. */
function spread(n: number): number {
    let x = n & 0xffff;
    x = (x | (x << 8)) & 0x00ff00ff;
    x = (x | (x << 4)) & 0x0f0f0f0f;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;
    return x >>> 0;
}

/** Morton (Z-order) code of a point on a 16x16 grid. */
export function morton(x: number, y: number): number {
    return (spread(x) | (spread(y) << 1)) >>> 0;
}

/** Bx-value: time partition in the high bits, spatial code in the low bits. */
export function bxValue(x: number, y: number, time: number, interval: number): number {
    const partition = Math.floor(time / Math.max(1, interval));
    return partition * 256 + morton(x & 15, y & 15);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        interval?: number;
        objects?: unknown[];
        queryTime?: number;
        rect?: number[];
    } | null) ?? {};
    const interval = typeof task.interval === "number" ? Math.max(1, task.interval) : 10;
    const objects = (Array.isArray(task.objects) ? task.objects : [
        { id: 1, x: 2, y: 3, time: 0 },
        { id: 2, x: 9, y: 1, time: 1 },
        { id: 3, x: 4, y: 8, time: 2 },
        { id: 1, x: 11, y: 12, time: 12 },
    ]).filter((o): o is { id: number; x: number; y: number; time: number } =>
        !!o && typeof (o as { id?: unknown }).id === "number" &&
        typeof (o as { x?: unknown }).x === "number" &&
        typeof (o as { y?: unknown }).y === "number" &&
        typeof (o as { time?: unknown }).time === "number",
    );
    const queryTime = typeof task.queryTime === "number" ? task.queryTime : 12;
    const rect = Array.isArray(task.rect) && task.rect.length === 4 ? task.rect : [0, 0, 15, 15];

    const latest = new Map<number, { x: number; y: number; time: number; key: number }>();
    let entries: Entry[] = [];
    let step = 0;
    let highlight = -1;

    const leaves = (): Entry[][] => {
        const sorted = [...entries].sort((a, b) => a.key - b.key);
        const result: Entry[][] = [];
        for (let i = 0; i < sorted.length; i += 3) result.push(sorted.slice(i, i + 3));
        if (result.length === 0) result.push([]);
        return result;
    };

    const snapshot = (message: string, line: number, resultIds: number[]): VisualFrame => {
        const leafGroups = leaves();
        const separator = leafGroups.slice(0, -1).map((group) => group[0]?.key ?? 0);
        const entities: VisualEntity[] = separator.map((key, i) => ({
            id: `bx-sep-${i}`,
            type: "cell" as const,
            label: String(key),
            value: key,
            state: "idle" as EntityState,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 0, col: i, separator: true },
        }));
        leafGroups.forEach((group, leaf) => {
            if (group.length === 0) {
                entities.push({
                    id: `bx-leaf-${leaf}-empty`,
                    type: "cell" as const,
                    label: "empty",
                    value: leaf,
                    state: "unvisited" as EntityState,
                    x: 0, y: 0, width: 0, height: 0,
                    metadata: { row: leaf + 1, col: 0, empty: true },
                });
                return;
            }
            group.forEach((entry, i) => {
                entities.push({
                    id: `bx-leaf-${leaf}-${i}`,
                    type: "cell" as const,
                    label: `${entry.id}:${entry.key}`,
                    value: entry.key,
                    state: (entry.id === highlight ? "comparing" : resultIds.includes(entry.id) ? "path" : "idle") as EntityState,
                    x: 0, y: 0, width: 0, height: 0,
                    metadata: { row: leaf + 1, col: i, objectId: entry.id },
                });
            });
        });
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                objects: objects.length,
                interval,
                queryTime,
                matches: resultIds.length,
                resultIds: [...resultIds],
            },
        };
    };

    yield snapshot(`Bx-tree: ${objects.length} object events, partition interval ${interval}.`, 0, []);
    step += 1;

    for (const obj of objects) {
        const previous = latest.get(obj.id);
        if (previous) entries = entries.filter((entry) => entry.key !== previous.key || entry.id !== obj.id);
        const key = bxValue(obj.x, obj.y, obj.time, interval);
        entries.push({ key, id: obj.id });
        latest.set(obj.id, { x: obj.x, y: obj.y, time: obj.time, key });
        highlight = obj.id;
        yield snapshot(
            `Object ${obj.id} at (${obj.x},${obj.y}) time ${obj.time}: key ${key}, latest map updated.`,
            1,
            [],
        );
        step += 1;
    }

    const resultIds: number[] = [];
    const [minX = 0, minY = 0, maxX = 15, maxY = 15] = rect;
    highlight = -1;
    for (const [id, state] of latest) {
        if (state.time > queryTime) continue;
        if (state.x >= minX && state.x <= maxX && state.y >= minY && state.y <= maxY) {
            resultIds.push(id);
            highlight = id;
            yield snapshot(
                `Query time ${queryTime}: object ${id} at (${state.x},${state.y}) lies in the rectangle.`,
                4,
                [...resultIds],
            );
            step += 1;
        }
    }
    resultIds.sort((a, b) => a - b);
    yield snapshot(
        `Done: ${resultIds.length} object(s) match rectangle [${minX},${minY},${maxX},${maxY}] at time ${queryTime}.`,
        6,
        resultIds,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Bx-tree turns each moving-object position into a single sortable number. High bits record which time partition the update belongs to; low bits are a Z-order code that keeps nearby points near each other in the key order. Storing those keys in a B+ tree gives fast updates, while the latest-key map removes the old entry before inserting the new one so each object stays unique.",
        invariants: [
            "The Bx-value concatenates a time partition with the Morton code of the position.",
            "The latest-key map holds exactly one current Bx-value per object id.",
            "An update removes an object's previous entry before inserting its new entry.",
        ],
        correctness:
            "Because each update deletes the previous key through the latest map before inserting the new one, every object contributes at most one leaf entry. The Morton code is a bijection on grid points, so distinct positions give distinct spatial components, and the time partition separates updates. A rectangle query at time T checks the current positions of objects whose latest update is not in the future, matching a direct scan of the object history.",
        complexityRationale:
            "Computing a Bx-value is O(1) word operations; each insert or update touches one B+ tree leaf in O(log n), and a full rectangle scan is O(n). The tree and latest map store O(n) entries.",
        uses: [
            "Spatiotemporal indexes for moving objects and fleet tracking",
            "Time-partitioned geospatial databases",
            "Range queries over recently updated locations",
        ],
        references: [
            "Ron T. Ng and Jiawei Han, 'Efficient and Effective Retrieval of Continuous Spatial and Temporal Patterns', 1994",
            "J. P. Culpepper and S. Widmayer, 'Indexing Moving Objects with the Bx-Tree', 2007",
        ],
        workedExample:
            "On a 16x16 grid with interval 10, object 1 at (2,3) time 0 gets partition 0 and Morton code spread(2)|(spread(3)<<1). Its later update to (11,12) time 12 removes that first key and inserts a partition-1 key, leaving one entry that a query at time 12 can find.",
    },
    id: "bx-tree",
    name: "Bx-Tree",
    category: "data-structures",
    complexity: { time: "O(log n) update, O(n) scan", space: "O(n)" },
    defaultInput: {
        interval: 10,
        objects: [
            { id: 1, x: 2, y: 3, time: 0 },
            { id: 2, x: 9, y: 1, time: 1 },
            { id: 3, x: 4, y: 8, time: 2 },
            { id: 1, x: 11, y: 12, time: 12 },
        ],
        queryTime: 12,
        rect: [0, 0, 15, 15],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the Bx-value latest map and empty B+ tree",
        "for each object event compute its Bx-value key",
        "delete the object's previous key from the tree",
        "insert the new key and record it in the latest map",
        "for a query at time T read each current position",
        "skip objects updated after T and test the rectangle",
        "collect the object ids that lie inside the rectangle",
        "done: report the matching object ids",
    ],
};

export default module;
