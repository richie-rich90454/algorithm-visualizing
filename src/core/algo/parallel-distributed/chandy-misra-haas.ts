/**
 * chandy-misra-haas.ts - Chandy-Misra-Haas Termination Detection
 *
 * A weight-throwing termination detector on a fixed control tree rooted at the
 * initiator. A unit of weight is split down to the active processes and flows
 * back up as each process finishes its local work and all of its children have
 * reported. The initiator declares termination only when all weight has
 * returned and no process still has outstanding work.
 *
 * The simulation is deterministic over a supplied tree and per-process work
 * counts. It does not model arbitrary application message traffic, dynamic
 * control edges, or asynchronous message delay beyond one round.
 *
 * Time:  O(rounds * processes) simulation steps
 * Space: O(processes) for weights, work counts, and report flags
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    parent?: number[];
    work?: number[];
}

interface Delivery {
    to: number;
    weight: number;
}

function makeBars(work: number[], reported: boolean[], active: number): VisualEntity[] {
    return work.map((units, i) => ({
        id: `proc-${i}`,
        type: "bar" as const,
        label: `P${i}: work ${units}${reported[i] ? " reported" : ""}`,
        value: units + (reported[i] ? 0.1 : 0),
        state: reported[i] ? "sorted" : i === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, work: units, reported: reported[i] ?? false },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const parent = Array.isArray(task.parent) && task.parent.length >= 2
        ? task.parent.map((v) => Number(v))
        : [-1, 0, 0, 1, 1, 2, 2];
    const n = parent.length;
    const work = Array.isArray(task.work) && task.work.length === n
        ? task.work.map((v) => Math.max(0, Math.floor(Number(v))))
        : [0, 0, 0, 2, 1, 3, 1];

    const children: number[][] = Array.from({ length: n }, () => []);
    for (let i = 1; i < n; i += 1) {
        const p = parent[i] ?? 0;
        if (p >= 0 && p < n) children[p]!.push(i);
    }
    const leaves = children.map((kids) => kids.length === 0);
    const leafCount = leaves.filter(Boolean).length || 1;
    const weight = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        if (leaves[i]) weight[i] = 1 / leafCount;
    }
    const workLeft = [...work];
    const reported = new Array<boolean>(n).fill(false);
    let inTransit: Delivery[] = [];
    let received = 0;
    let round = 0;
    let terminated = false;
    const maxRounds = 100;

    const metaFor = (phase: string) => ({
        round,
        processes: n,
        work: [...workLeft],
        weight: [...weight],
        reported: [...reported],
        received,
        inTransit: inTransit.length,
        activeCount: workLeft.reduce((m, w) => m + (w > 0 ? 1 : 0), 0),
        terminated,
        phase,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(workLeft, reported, -1),
        edges: [],
        description: `Initiator starts termination detection on a ${n}-process tree with weight split across the leaves.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor("init"),
    };
    let step = 1;

    while (!terminated && round < maxRounds) {
        round += 1;

        for (const msg of inTransit) {
            weight[msg.to] = (weight[msg.to] ?? 0) + msg.weight;
            if (msg.to === 0) received += msg.weight;
        }
        inTransit = [];

        for (let i = 0; i < n; i += 1) {
            if ((workLeft[i] ?? 0) > 0) workLeft[i] = (workLeft[i] ?? 0) - 1;
        }

        for (let i = 1; i < n; i += 1) {
            if (reported[i]) continue;
            if ((workLeft[i] ?? 0) > 0) continue;
            const kids = children[i] ?? [];
            if (kids.some((k) => !reported[k])) continue;
            inTransit.push({ to: parent[i] ?? 0, weight: weight[i] ?? 0 });
            weight[i] = 0;
            reported[i] = true;
        }

        const rootChildren = children[0] ?? [];
        const allReported = rootChildren.every((k) => reported[k]);
        if ((workLeft[0] ?? 0) === 0 && allReported && inTransit.length === 0 && Math.abs(received - 1) < 1e-9) {
            terminated = true;
        }

        yield {
            stepNumber: step,
            entities: makeBars(workLeft, reported, -1),
            edges: [],
            description: terminated
                ? `Round ${round}: all weight ${received.toFixed(3)} returned and no work remains; initiator declares termination.`
                : `Round ${round}: ${workLeft.reduce((m, w) => m + w, 0)} work unit(s) left, ${inTransit.length} report(s) in transit, ${received.toFixed(3)} weight returned.`,
            codeLineNumber: terminated ? 6 : 4,
            layout: "array",
            meta: metaFor(terminated ? "terminated" : "round"),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(workLeft, reported, -1),
        edges: [],
        description: `Termination detection ${terminated ? "succeeded" : "did not complete"} after ${round} round(s) with returned weight ${received.toFixed(3)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: metaFor("done"),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Distributed termination detection must answer a global question using only local information. The weight-throwing idea gives the initiator one unit of weight to watch. The weight is distributed along control messages to the active processes, and each process passes its share back up the control tree once its own work and all its children's work are finished. When the full unit returns to an idle initiator, the whole computation must be finished.",
        invariants: [
            "The total weight in the system is conserved and equals one until detection completes.",
            "A process reports only after its own work is exhausted and every child has reported.",
            "The initiator never declares termination while any process still has outstanding work.",
        ],
        correctness:
            "Weight is conserved because each report transfers exactly the accumulated share to the parent and leaves the sender with zero. A process reports only when its subtree is finished, so by induction a report reaching the initiator certifies that an entire subtree has no remaining work. When all children of the initiator have reported and every work counter is zero, the whole tree is finished, and the returned weight equals one. Conversely, if work remained somewhere, that process could not have reported, so the initiator could not receive the full weight.",
        complexityRationale:
            "Each round scans every process once to advance work and once to issue reports, so a run of r rounds costs O(r times processes). The weights, work counts, report flags, and pending deliveries are all O(processes) space.",
        uses: [
            "Detecting completion of distributed graph computations",
            "Stopping parallel search once all workers are idle",
            "A teaching model for global predicates and weight conservation",
        ],
        references: [
            "Chandy, Misra, and Haas, Distributed Deadlock Detection, IEEE Transactions on Software Engineering, 1983",
            "Mattern, Algorithms for Distributed Termination Detection, Distributed Computing, 1987",
        ],
        workedExample:
            "On a tree where the initiator has two children and each child has two leaves, the four leaves start with one quarter of the weight each. As leaves finish they report upward; internal nodes forward the combined weight when both children have reported. Once both children of the initiator report a total of one and no work remains, termination is declared.",
    },
    id: "chandy-misra-haas",
    name: "Chandy-Misra-Haas Termination Detection",
    category: "parallel-distributed",
    complexity: { time: "O(rounds * processes)", space: "O(processes)" },
    defaultInput: { parent: [-1, 0, 0, 1, 1, 2, 2], work: [0, 0, 0, 2, 1, 3, 1] },
    visualType: "array",
    run,
    pseudocode: [
        "build the control tree rooted at the initiator",
        "split one unit of weight across the active leaves",
        "each round deliver any report messages in transit",
        "decrement the local work counter of active processes",
        "a process whose work is done and whose children reported passes its weight up",
        "the initiator accumulates returned weight",
        "declare termination when all work is zero and the full weight returned",
        "otherwise continue to the next round",
        "done: report whether termination was detected",
    ],
};

export default module;
