/**
 * can-dht.ts - Content Addressable Network Routing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A content addressable network divides a d-dimensional coordinate space into
 * zones, one per node. A key hashes to a point in that space and is stored by
 * the node whose zone contains the point. Routing is greedy: at each hop the
 * message moves to an adjacent zone along the coordinate with the largest
 * remaining distance to the target, so every hop fixes one coordinate.
 *
 * ---------------------------------------------------------------------------
 * Model limits
 * ---------------------------------------------------------------------------
 *   - Two-dimensional torus with a static, evenly divided grid of zones.
 *   - No node joins, departures, zone splits, or failed neighbors.
 *   - Keys are points in the unit square; hashing is the identity mapping.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(dimension * zones per side) hops to route a key
 *   Space: O(zones) for the zone table
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CanInput {
    gridX?: number;
    gridY?: number;
    key?: number[];
    start?: number[];
}

function makeCells(
    gridX: number,
    gridY: number,
    current: [number, number],
    target: [number, number],
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let y = 0; y < gridY; y += 1) {
        for (let x = 0; x < gridX; x += 1) {
            let state: EntityState = "idle";
            if (x === current[0] && y === current[1]) state = done ? "sorted" : "active";
            else if (x === target[0] && y === target[1]) state = "comparing";
            entities.push({
                id: `zone-${x}-${y}`,
                type: "cell" as const,
                label: `(${x},${y})`,
                value: `${x},${y}`,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: y, col: x, zoneX: x, zoneY: y },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CanInput | null) ?? {};
    const gridX = Math.max(2, Math.min(16, Math.floor(typeof task.gridX === "number" ? task.gridX : 4)));
    const gridY = Math.max(2, Math.min(16, Math.floor(typeof task.gridY === "number" ? task.gridY : 4)));
    const key = Array.isArray(task.key) && task.key.length >= 2
        ? task.key.map((v) => Math.max(0, Math.min(1 - 1e-9, v)))
        : [0.72, 0.83];
    const target: [number, number] = [
        Math.min(gridX - 1, Math.floor(key[0]! * gridX)),
        Math.min(gridY - 1, Math.floor(key[1]! * gridY)),
    ];
    const start: [number, number] = [
        Math.min(gridX - 1, Math.max(0, Math.floor(Array.isArray(task.start) ? (task.start[0] ?? 0) : 0))),
        Math.min(gridY - 1, Math.max(0, Math.floor(Array.isArray(task.start) ? (task.start[1] ?? 0) : 0))),
    ];
    const current: [number, number] = [start[0], start[1]];
    let hops = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(gridX, gridY, current, target, false),
        edges: [],
        description: `Routing key (${key[0]!.toFixed(2)}, ${key[1]!.toFixed(2)}) from zone (${current[0]}, ${current[1]}) toward zone (${target[0]}, ${target[1]}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: gridY, cols: gridX, hops, distance: Math.abs(target[0] - current[0]) + Math.abs(target[1] - current[1]), arrived: false },
    };

    let step = 1;
    let guard = 0;
    while ((current[0] !== target[0] || current[1] !== target[1]) && guard < gridX + gridY) {
        const dx = target[0] - current[0];
        const dy = target[1] - current[1];
        const scaledX = (Math.abs(dx) + 1) / gridX;
        const scaledY = (Math.abs(dy) + 1) / gridY;
        let moved = "";
        if (dx !== 0 && (dy === 0 || scaledX >= scaledY)) {
            current[0] += dx > 0 ? 1 : -1;
            moved = "x";
        } else if (dy !== 0) {
            current[1] += dy > 0 ? 1 : -1;
            moved = "y";
        }
        hops += 1;
        guard += 1;
        const distance = Math.abs(target[0] - current[0]) + Math.abs(target[1] - current[1]);
        yield {
            stepNumber: step,
            entities: makeCells(gridX, gridY, current, target, false),
            edges: [],
            description: `Hop ${hops}: moved along ${moved} into zone (${current[0]}, ${current[1]}); ${distance} coordinate step(s) remain.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: gridY, cols: gridX, hops, distance, arrived: distance === 0, moved },
        };
        step += 1;
    }

    const arrived = current[0] === target[0] && current[1] === target[1];
    yield {
        stepNumber: step,
        entities: makeCells(gridX, gridY, current, target, true),
        edges: [],
        description: arrived
            ? `Key found in zone (${current[0]}, ${current[1]}) after ${hops} hop(s).`
            : "Routing stopped before reaching the target zone.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: gridY, cols: gridX, hops, distance: arrived ? 0 : 1, arrived },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A content addressable network treats the key space as a geometric coordinate system and gives each node a rectangular zone. To find a key, a message looks at its current zone and the key's point, then steps to the neighboring zone that closes the largest remaining gap. After a few hops it lands in the zone that owns the key.",
        invariants: [
            "Each zone belongs to exactly one node and covers a fixed part of the coordinate space.",
            "Every hop changes only one coordinate and reduces the remaining distance by one.",
            "The target zone is the one whose rectangle contains the key point.",
        ],
        correctness:
            "Zones tile the unit square, so every key point lies in exactly one zone. If the current zone is not the target, at least one coordinate of the target differs; moving one zone along that coordinate is a valid neighbor hop in the torus. Greedy selection never increases either coordinate distance, so the Manhattan distance to the target falls by exactly one per hop. After |dx| plus |dy| hops both coordinates match the target zone and the key has been located.",
        complexityRationale:
            "Each hop examines the two coordinate differences and moves one step, constant work, and at most one step per coordinate gap is needed, so routing takes O(d times zones per side) hops in the worst case. The node holds O(zones) neighbor and zone information.",
        uses: [
            "Peer-to-peer key lookup without a central index",
            "Distributed hash tables with geometric routing",
            "Locality-aware overlay networks",
        ],
        references: [
            "Ratnasamy, Francis, Handley, Karp, and Shenker, A Scalable Content-Addressable Network, 2001",
            "Balakrishnan and Karger, Layering as Optimization Decomposition",
        ],
        workedExample:
            "In a four by four CAN, a key hashing to point (0.72, 0.83) belongs to zone (2, 3). Starting from zone (0, 0), the greedy rule fixes the y coordinate first and then the x coordinate, arriving after five hops, which equals two plus three.",
    },
    id: "can-dht",
    name: "CAN DHT Routing",
    category: "parallel-distributed",
    complexity: { time: "O(d * sqrt(n))", space: "O(n)" },
    defaultInput: { gridX: 4, gridY: 4, key: [0.72, 0.83], start: [0, 0] },
    visualType: "grid",
    run,
    pseudocode: [
        "divide the key space into a grid of zones, one per node",
        "hash the key to a point and identify its owning zone",
        "begin at the starting zone and set hops to zero",
        "while the current zone is not the target zone",
        "compare the remaining x and y gaps and move one zone along the larger",
        "record the new zone and increment the hop count",
        "stop when both coordinates match the target zone",
        "done: report the route and the hop count",
    ],
};

export default module;
