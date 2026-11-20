/**
 * bug-algorithm-navigation.ts - Bug1 robot navigation around circular obstacles.
 *
 * The robot heads straight for the goal. When the next step would enter an
 * obstacle, it walks all the way around that obstacle's boundary, remembers
 * the boundary point closest to the goal, leaves from there, and resumes its
 * straight run. Unlike an potential field, Bug1 cannot get stuck in a local
 * minimum in front of a single obstacle.
 *
 * Time: O(maxSteps * obstacles). Space: O(pathLength).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
interface Disk {
    center: Pt;
    radius: number;
}

function node(id: string, p: Pt, state: EntityState, label: string): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [p[0], p[1]],
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: {},
    };
}

function buildPath(start: Pt, goal: Pt, disks: Disk[], delta: number, maxSteps: number) {
    const margin = 0.05;
    const inside = (p: Pt): Disk | null => {
        let hit: Disk | null = null;
        let closest = Infinity;
        for (const disk of disks) {
            const d = Math.hypot(p[0] - disk.center[0], p[1] - disk.center[1]);
            if (d < disk.radius + 1e-9 && d < closest) {
                closest = d;
                hit = disk;
            }
        }
        return hit;
    };
    const boundaryPoint = (disk: Disk, angle: number): Pt => [
        disk.center[0] + (disk.radius + margin) * Math.cos(angle),
        disk.center[1] + (disk.radius + margin) * Math.sin(angle),
    ];

    const path: Pt[] = [start];
    let pos: Pt = start;
    let hits = 0;
    let steps = 0;

    while (steps < maxSteps && Math.hypot(pos[0] - goal[0], pos[1] - goal[1]) > delta) {
        const dx = goal[0] - pos[0];
        const dy = goal[1] - pos[1];
        const len = Math.hypot(dx, dy);
        const next: Pt = [pos[0] + (dx / len) * delta, pos[1] + (dy / len) * delta];
        const disk = inside(next);
        if (disk) {
            const angle0 = Math.atan2(pos[1] - disk.center[1], pos[0] - disk.center[0]);
            let bestAngle = angle0;
            let bestDistance = Infinity;
            const boundaryRadius = disk.radius + margin;
            const dAngle = delta / boundaryRadius;
            let traveled = 0;
            let angle = angle0;
            path.push(boundaryPoint(disk, angle));
            while (traveled < 2 * Math.PI) {
                angle += Math.min(dAngle, 2 * Math.PI - traveled);
                traveled += Math.min(dAngle, 2 * Math.PI - traveled);
                const bp = boundaryPoint(disk, angle);
                path.push(bp);
                const dGoal = Math.hypot(bp[0] - goal[0], bp[1] - goal[1]);
                if (dGoal < bestDistance) {
                    bestDistance = dGoal;
                    bestAngle = angle;
                }
            }
            let target = bestAngle;
            while (target <= angle + 1e-9) target += 2 * Math.PI;
            while (angle + 1e-9 < target) {
                angle = Math.min(angle + dAngle, target);
                path.push(boundaryPoint(disk, angle));
            }
            pos = boundaryPoint(disk, bestAngle);
            hits += 1;
            steps += 1;
            continue;
        }
        pos = next;
        path.push(pos);
        steps += 1;
    }
    const reached = Math.hypot(pos[0] - goal[0], pos[1] - goal[1]) <= delta;
    return { path, hits, reached, steps };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        start?: Pt;
        goal?: Pt;
        obstacles?: Disk[];
        step?: number;
        maxSteps?: number;
    } | null) ?? {};
    const start: Pt = task.start ?? [0, 0];
    const goal: Pt = task.goal ?? [10, 0];
    const disks: Disk[] = task.obstacles ?? [{ center: [5, 0.6], radius: 1.2 }];
    const delta = typeof task.step === "number" && task.step > 0 ? task.step : 0.35;
    const maxSteps = typeof task.maxSteps === "number" ? Math.max(1, Math.floor(task.maxSteps)) : 200;

    const ringEntities = (): { entities: VisualEntity[]; edges: VisualEdge[] } => {
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        const samples = 40;
        disks.forEach((disk, k) => {
            for (let j = 0; j < samples; j += 1) {
                const angle = (2 * Math.PI * j) / samples;
                entities.push(
                    node(
                        `o-${k}-${j}`,
                        [disk.center[0] + disk.radius * Math.cos(angle), disk.center[1] + disk.radius * Math.sin(angle)],
                        "error",
                        "",
                    ),
                );
                edges.push({
                    id: `oe-${k}-${j}`,
                    sourceId: `o-${k}-${j}`,
                    targetId: `o-${k}-${(j + 1) % samples}`,
                    label: "",
                    state: "error" as EntityState,
                    directed: false,
                });
            }
        });
        return { entities, edges };
    };

    const { path, hits, reached, steps } = buildPath(start, goal, disks, delta, maxSteps);
    const rings = ringEntities();
    let step = 0;

    const frameFor = (prefix: number, done: boolean): VisualFrame => {
        const visible = path.slice(0, prefix);
        const entities: VisualEntity[] = [
            ...rings.entities,
            node("start", start, "pivot", "S"),
            node("goal", goal, "sorted", "G"),
            ...visible.map((p, i) => node(`p-${i}`, p, i === visible.length - 1 && !done ? "active" : "visited", "")),
        ];
        const edges: VisualEdge[] = [
            ...rings.edges,
            ...visible.slice(1).map((_, i) => ({
                id: `pe-${i}`,
                sourceId: `p-${i}`,
                targetId: `p-${i + 1}`,
                label: "",
                state: "path" as EntityState,
                directed: false,
            })),
        ];
        return {
            stepNumber: step,
            entities,
            edges,
            description: done
                ? `Done: ${path.length} path point(s), ${hits} obstacle circumnavigation(s), goal ${reached ? "reached" : "not reached"}.`
                : `Bug1 step ${step}: ${visible.length}/${path.length} path points traced.`,
            codeLineNumber: done ? 7 : 4,
            layout: "point",
            meta: {
                start: [start[0], start[1]],
                goal: [goal[0], goal[1]],
                obstacles: disks.flatMap((d) => [d.center[0], d.center[1], d.radius]),
                path: path.flatMap((p) => [p[0], p[1]]),
                hits,
                reached,
                steps,
            },
        };
    };

    yield frameFor(1, false);
    step += 1;
    const samples = Math.min(20, Math.max(1, path.length - 1));
    for (let k = 1; k <= samples; k += 1) {
        const prefix = Math.max(1, Math.floor((k * (path.length - 1)) / samples));
        yield frameFor(prefix, false);
        step += 1;
    }
    yield frameFor(path.length, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Bug1 navigation is deliberately simple: walk straight at the goal until an obstacle blocks you, then walk all the way around it. While circling, note the spot closest to the goal; once the circuit is complete, leave from that spot and resume the straight run. The full circuit is what keeps the robot from committing to a bad side of the obstacle.",
        invariants: [
            "Every path point lies outside every obstacle disk.",
            "During a hit the robot completes a full lap of the obstacle before leaving.",
            "The robot departs from the boundary point with minimum distance to the goal on that lap.",
        ],
        correctness:
            "Walking toward the goal reduces distance whenever the path is clear. On a hit, the robot visits the whole boundary and therefore sees its best possible departure point; after leaving from that point, resuming the straight run cannot be worse than staying on the boundary. Since each lap is finite and each clear run strictly reduces goal distance, the robot either reaches the goal or terminates at the step limit, and it never crosses an obstacle because moves that would enter one are replaced by boundary motion.",
        complexityRationale:
            "Each of the bounded number of steps tests all o obstacles and, on a hit, emits a boundary lap of O(radius / step) points, so time is O(maxSteps * o) plus boundary work. The saved path uses O(pathLength) space.",
        uses: [
            "Reactive navigation for simple mobile robots without a global map",
            "Teaching the difference between local and global path planning",
            "Baseline behavior for comparing smarter planners",
        ],
        references: [
            "Lumelsky and Stepanov, Path-Planning Strategies for a Point Mobile Automaton, Algorithmica, 1987",
            "Siegwart and Nourbakhsh, Introduction to Autonomous Mobile Robots, Chapter 5",
        ],
        workedExample:
            "From (0,0) to (10,0) with a disk centered just above the straight line at (5,0.6), the robot walks east until the disk blocks it. It circles the disk, records the lowest boundary point as closest to the goal, leaves from there, and walks east to the goal.",
    },
    id: "bug-algorithm-navigation",
    name: "Bug Algorithm Navigation",
    category: "geometry",
    complexity: { time: "O(s * o)", space: "O(p)" },
    defaultInput: {
        start: [0, 0],
        goal: [10, 0],
        obstacles: [{ center: [5, 0.6], radius: 1.2 }],
        step: 0.35,
        maxSteps: 200,
    },
    visualType: "point",
    run,
    pseudocode: [
        "start at the initial position",
        "head toward the goal in small steps",
        "if the next step enters an obstacle",
        "circle the entire obstacle boundary",
        "record the boundary point nearest the goal",
        "leave from that point and resume the straight run",
        "stop when the goal is reached",
        "done: return the collision-free path",
    ],
};

export default module;
