/**
 * dynamic-window-approach.ts - Velocity-space robot navigation.
 *
 * Only velocities the robot can reach within one short time step form the
 * dynamic window. Each (linear, angular) pair in a sampled grid of that window
 * is simulated over a short horizon, then scored for goal progress, obstacle
 * clearance and speed. The best collision-free trajectory is executed and the
 * process repeats.
 *
 * Time: O(steps * samplesV * samplesOmega * horizon * obstacles).
 * Space: O(steps + samples).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
interface Disk {
    center: Pt;
    radius: number;
}
interface Pose {
    x: number;
    y: number;
    theta: number;
    v: number;
    omega: number;
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

function windowRange(v: number, max: number, accel: number, dt: number, signed: boolean) {
    const low = signed ? -max : 0;
    return [
        Math.max(low, v - accel * dt),
        Math.min(max, v + accel * dt),
    ] as [number, number];
}

function simulate(
    pose: Pose,
    v: number,
    omega: number,
    goal: Pt,
    disks: Disk[],
    robotRadius: number,
    dt: number,
    horizon: number,
) {
    let x = pose.x;
    let y = pose.y;
    let theta = pose.theta;
    let minClearance = Infinity;
    let collision = false;
    const points: Pt[] = [[x, y]];
    for (let s = 0; s < horizon; s += 1) {
        theta += omega * dt;
        x += v * dt * Math.cos(theta);
        y += v * dt * Math.sin(theta);
        points.push([x, y]);
        for (const disk of disks) {
            const clear = Math.hypot(x - disk.center[0], y - disk.center[1]) - disk.radius - robotRadius;
            if (clear < minClearance) minClearance = clear;
            if (clear < 0) collision = true;
        }
    }
    return {
        points,
        collision,
        minClearance: Number.isFinite(minClearance) ? minClearance : 10,
        goalDistance: Math.hypot(x - goal[0], y - goal[1]),
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        start?: Pt;
        goal?: Pt;
        heading?: number;
        obstacles?: Disk[];
        robotRadius?: number;
        maxSpeed?: number;
        maxOmega?: number;
        accel?: number;
        angularAccel?: number;
        dt?: number;
        horizon?: number;
        samplesV?: number;
        samplesOmega?: number;
        weights?: [number, number, number];
        maxSteps?: number;
    } | null) ?? {};
    const start: Pt = task.start ?? [0, 0];
    const goal: Pt = task.goal ?? [10, 0];
    const disks: Disk[] = task.obstacles ?? [{ center: [5, 1.6], radius: 1 }];
    const robotRadius = typeof task.robotRadius === "number" ? task.robotRadius : 0.2;
    const maxSpeed = typeof task.maxSpeed === "number" ? task.maxSpeed : 1;
    const maxOmega = typeof task.maxOmega === "number" ? task.maxOmega : 1;
    const accel = typeof task.accel === "number" ? task.accel : 0.3;
    const angularAccel = typeof task.angularAccel === "number" ? task.angularAccel : 0.3;
    const dt = typeof task.dt === "number" && task.dt > 0 ? task.dt : 0.5;
    const horizon = typeof task.horizon === "number" ? Math.max(1, Math.floor(task.horizon)) : 6;
    const samplesV = typeof task.samplesV === "number" ? Math.max(2, Math.floor(task.samplesV)) : 4;
    const samplesOmega = typeof task.samplesOmega === "number" ? Math.max(2, Math.floor(task.samplesOmega)) : 7;
    const wProgress = (task.weights?.[0] ?? 2) as number;
    const wClearance = (task.weights?.[1] ?? 0.5) as number;
    const wSpeed = (task.weights?.[2] ?? 0.2) as number;
    const maxSteps = typeof task.maxSteps === "number" ? Math.max(1, Math.floor(task.maxSteps)) : 40;

    const pose: Pose = { x: start[0], y: start[1], theta: task.heading ?? 0, v: 0, omega: 0 };
    const startGoalDistance = Math.hypot(start[0] - goal[0], start[1] - goal[1]);
    const positions: Pt[] = [[pose.x, pose.y]];
    const chosenV: number[] = [];
    const chosenOmega: number[] = [];
    const records: Array<{ pose: Pose; trajectories: Array<{ points: Pt[]; chosen: boolean }> }> = [];

    let step = 0;
    while (step < maxSteps && startGoalDistance > 0 && Math.hypot(pose.x - goal[0], pose.y - goal[1]) > 0.5) {
        const [vLow, vHigh] = windowRange(pose.v, maxSpeed, accel, dt, false);
        const [wLow, wHigh] = windowRange(pose.omega, maxOmega, angularAccel, dt, true);
        const trajectories: Array<{ points: Pt[]; chosen: boolean; v: number; omega: number; score: number }> = [];
        let bestScore = -Infinity;
        let bestV = 0;
        let bestOmega = 0;
        const before = Math.hypot(pose.x - goal[0], pose.y - goal[1]);
        for (let i = 0; i < samplesV; i += 1) {
            const v = samplesV === 1 ? vLow : vLow + ((vHigh - vLow) * i) / (samplesV - 1);
            for (let j = 0; j < samplesOmega; j += 1) {
                const omega = samplesOmega === 1 ? wLow : wLow + ((wHigh - wLow) * j) / (samplesOmega - 1);
                const sim = simulate(pose, v, omega, goal, disks, robotRadius, dt, horizon);
                const score = sim.collision
                    ? -Infinity
                    : wProgress * (before - sim.goalDistance) +
                      wClearance * Math.min(sim.minClearance, 2) +
                      wSpeed * v;
                trajectories.push({ points: sim.points, chosen: false, v, omega, score });
                if (score > bestScore) {
                    bestScore = score;
                    bestV = v;
                    bestOmega = omega;
                }
            }
        }
        if (bestScore === -Infinity) {
            bestV = 0;
            bestOmega = 0;
        }
        for (const traj of trajectories) {
            traj.chosen = traj.v === bestV && traj.omega === bestOmega;
        }
        pose.theta += bestOmega * dt;
        pose.x += bestV * dt * Math.cos(pose.theta);
        pose.y += bestV * dt * Math.sin(pose.theta);
        pose.v = bestV;
        pose.omega = bestOmega;
        positions.push([pose.x, pose.y]);
        chosenV.push(bestV);
        chosenOmega.push(bestOmega);
        records.push({ pose: { ...pose }, trajectories: trajectories.map((t) => ({ points: t.points, chosen: t.chosen })) });
        step += 1;
    }

    const reached = Math.hypot(pose.x - goal[0], pose.y - goal[1]) <= 0.5;
    const finalGoalDistance = Math.hypot(pose.x - goal[0], pose.y - goal[1]);

    const ringEntities = (): { entities: VisualEntity[]; edges: VisualEdge[] } => {
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        const samples = 40;
        disks.forEach((disk, k) => {
            for (let j = 0; j < samples; j += 1) {
                const angle = (2 * Math.PI * j) / samples;
                entities.push(
                    node(`o-${k}-${j}`, [disk.center[0] + disk.radius * Math.cos(angle), disk.center[1] + disk.radius * Math.sin(angle)], "error", ""),
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

    const baseMeta = (current: number) => ({
        start: [start[0], start[1]],
        goal: [goal[0], goal[1]],
        obstacles: disks.flatMap((d) => [d.center[0], d.center[1], d.radius]),
        positions: positions.flatMap((p) => [p[0], p[1]]),
        chosenV,
        chosenOmega,
        startV: 0,
        startOmega: 0,
        dt,
        accel,
        angularAccel,
        maxSpeed,
        maxOmega,
        current,
        reached,
        steps: step,
        startGoalDistance,
        finalGoalDistance,
    });

    const rings = ringEntities();
    let frameStep = 0;

    const frameFor = (record: { pose: Pose; trajectories: Array<{ points: Pt[]; chosen: boolean }> } | null, done: boolean): VisualFrame => {
        const entities: VisualEntity[] = [...rings.entities, node("start", start, "pivot", "S"), node("goal", goal, "sorted", "G")];
        const edges: VisualEdge[] = [...rings.edges];
        positions.slice(0, done ? positions.length : (record ? -1 : 1)).forEach((p, i) => {
            entities.push(node(`path-${i}`, p, "visited", ""));
            if (i > 0) {
                edges.push({ id: `path-e-${i}`, sourceId: `path-${i - 1}`, targetId: `path-${i}`, label: "", state: "path" as EntityState, directed: false });
            }
        });
        if (record) {
            record.trajectories.forEach((traj, t) => {
                traj.points.forEach((p, k) => {
                    entities.push(node(`t-${t}-${k}`, p, traj.chosen ? "active" : "unvisited", ""));
                    if (k > 0) {
                        edges.push({
                            id: `te-${t}-${k}`,
                            sourceId: `t-${t}-${k - 1}`,
                            targetId: `t-${t}-${k}`,
                            label: "",
                            state: traj.chosen ? "active" as EntityState : "unvisited" as EntityState,
                            directed: false,
                        });
                    }
                });
            });
            entities.push(node("robot", [record.pose.x, record.pose.y], "pivot", "R"));
        }
        return {
            stepNumber: frameStep,
            entities,
            edges,
            description: done
                ? `Done: ${step} step(s), goal ${reached ? "reached" : "not reached"}, final distance ${finalGoalDistance.toFixed(2)}.`
                : `DWA step: sampled ${samplesV * samplesOmega} velocities, executed the best collision-free one.`,
            codeLineNumber: done ? 8 : 4,
            layout: "point",
            meta: baseMeta(records.length),
        };
    };

    yield frameFor(null, false);
    frameStep += 1;
    const samples = Math.min(14, Math.max(1, records.length));
    for (let k = 0; k < samples; k += 1) {
        const index = Math.min(records.length - 1, Math.floor(((k + 1) * records.length) / samples));
        const record = records[index];
        if (record) {
            yield frameFor(record, false);
            frameStep += 1;
        }
    }
    yield frameFor(null, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A robot can only change speed and turning rate so fast. The dynamic window is the small rectangle of velocities reachable in the next instant. DWA tries a grid of those velocities, simulates where each would lead, and picks the one that makes the most progress toward the goal while staying clear of obstacles and moving quickly.",
        invariants: [
            "Every sampled velocity lies inside the acceleration-limited dynamic window.",
            "Trajectories that collide with an obstacle are given no score and cannot win.",
            "The executed velocity is always the highest-scoring collision-free candidate.",
        ],
        correctness:
            "Restricting to the dynamic window guarantees the chosen command is physically reachable from the current velocity. Simulating each command over the horizon and rejecting collisions makes the chosen short trajectory obstacle-free for that horizon. Scoring by goal progress, clearance and speed selects the best reachable tradeoff, so repeating the choice monotonically improves progress whenever a collision-free improving command exists, and the robot stops safely when none does.",
        complexityRationale:
            "Each step evaluates samplesV times samplesOmega trajectories of horizon points against o obstacles, giving O(steps * samplesV * samplesOmega * horizon * o) time. Storing the path and the sampled trajectories for replay uses space proportional to the number of recorded steps and samples.",
        uses: [
            "Local navigation for differential-drive mobile robots",
            "Steering for autonomous vehicles in dynamic environments",
            "Game AI obstacle avoidance with velocity-based motion",
        ],
        references: [
            "Fox, Burgard, and Thrun, The Dynamic Window Approach to Collision Avoidance, IEEE Robotics & Automation Magazine, 1997",
            "Siegwart and Nourbakhsh, Introduction to Autonomous Mobile Robots, Chapter 5",
        ],
        workedExample:
            "Starting at (0,0) facing east with the goal at (10,0), the window begins at velocities near zero. Samples that turn sharply score poorly for progress, so the robot accelerates east. When an obstacle nears, samples that curve around it keep a positive clearance score and win until the goal is reached.",
    },
    id: "dynamic-window-approach",
    name: "Dynamic Window Approach",
    category: "geometry",
    complexity: { time: "O(s * v * w * h * o)", space: "O(s * v * w)" },
    defaultInput: {
        start: [0, 0],
        goal: [10, 0],
        heading: 0,
        obstacles: [{ center: [5, 1.6], radius: 1 }],
        robotRadius: 0.2,
        maxSpeed: 1,
        maxOmega: 1,
        accel: 0.3,
        angularAccel: 0.3,
        dt: 0.5,
        horizon: 6,
        samplesV: 4,
        samplesOmega: 7,
        weights: [2, 0.5, 0.2],
        maxSteps: 40,
    },
    visualType: "point",
    run,
    pseudocode: [
        "read the current pose and velocity",
        "build the acceleration-limited dynamic window",
        "for each sampled velocity pair in the window",
        "simulate the trajectory over a short horizon",
        "discard trajectories that collide",
        "score the rest for progress, clearance and speed",
        "execute the best collision-free velocity",
        "repeat until the goal is reached",
        "done: return the navigated path",
    ],
};

export default module;
