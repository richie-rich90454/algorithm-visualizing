/**
 * scaffold-federated.ts - SCAFFOLD Federated Optimization
 *
 * SCAFFOLD fixes client drift in federated learning by giving the server and
 * each client a control variate. A client takes local steps on a corrected
 * gradient (its own gradient minus its control plus the server control), then
 * updates its control so the corrections cancel client drift in aggregate.
 * This gives convergence that does not degrade with data heterogeneity.
 *
 * Time O(rounds * clients * tau * d^2), space O(clients * d).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Client {
    H: number[][];
    b: number[];
}

interface ScaffoldInput {
    x0: number[];
    clients: Client[];
    localSteps: number;
    lr: number;
    rounds: number;
}

export interface ScaffoldRound {
    round: number;
    x: number[];
    c: number[];
    objective: number;
}

function grad(client: Client, w: number[]): number[] {
    return client.H.map((row, i) => row.reduce((acc, v, j) => acc + v * (w[j] ?? 0), 0) - (client.b[i] ?? 0));
}

function average(vecs: number[][]): number[] {
    const d = vecs[0]?.length ?? 0;
    const out = new Array(d).fill(0);
    for (const v of vecs) {
        for (let i = 0; i < d; i += 1) out[i] = (out[i] ?? 0) + (v[i] ?? 0) / vecs.length;
    }
    return out;
}

/** Run SCAFFOLD rounds on quadratic client objectives. */
export function scaffoldRun(input: ScaffoldInput): ScaffoldRound[] {
    const { clients, localSteps, lr, rounds } = input;
    const d = input.x0.length;
    let x = [...input.x0];
    let c = new Array(d).fill(0);
    let controls = clients.map(() => new Array(d).fill(0));
    const log: ScaffoldRound[] = [];
    for (let round = 0; round < rounds; round += 1) {
        const newYs: number[][] = [];
        const newControls: number[][] = [];
        for (let k = 0; k < clients.length; k += 1) {
            const client = clients[k]!;
            const ck = controls[k] ?? [];
            let y = [...x];
            for (let s = 0; s < localSteps; s += 1) {
                const g = grad(client, y);
                y = y.map((v, i) => v - lr * ((g[i] ?? 0) - (ck[i] ?? 0) + (c[i] ?? 0)));
            }
            const scale = 1 / (lr * localSteps);
            newControls.push(ck.map((v, i) => v - (c[i] ?? 0) + scale * ((x[i] ?? 0) - (y[i] ?? 0))));
            newYs.push(y);
        }
        const nextX = average(newYs);
        const deltas = newControls.map((nc, k) => nc.map((v, i) => v - (controls[k]?.[i] ?? 0)));
        c = c.map((v, i) => v + average(deltas)[i]!);
        controls = newControls;
        x = nextX;
        const objective = clients.reduce((acc, client) => {
            const g = grad(client, x);
            return acc + g.reduce((s, v, i) => s + v * (x[i] ?? 0), 0) / 2;
        }, 0) / clients.length;
        log.push({ round: round + 1, x: [...x], c: [...c], objective });
    }
    return log;
}

function makeCells(log: ScaffoldRound[], revealed: number, d: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    log.forEach((r, row) => {
        for (let col = 0; col < d; col += 1) {
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: row <= revealed ? `r${r.round} x${col}=${(r.x[col] ?? 0).toFixed(3)}` : "?",
                value: row <= revealed ? (r.x[col] ?? 0) : 0,
                state: row <= revealed ? "sorted" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<ScaffoldInput> | null) ?? {};
    const x0 = task.x0 ?? [0];
    const clients = task.clients ?? [
        { H: [[2]], b: [2] },
        { H: [[4]], b: [0] },
        { H: [[2]], b: [-2] },
    ];
    const localSteps = typeof task.localSteps === "number" ? Math.max(1, task.localSteps) : 3;
    const lr = typeof task.lr === "number" ? task.lr : 0.1;
    const rounds = typeof task.rounds === "number" ? Math.max(1, task.rounds) : 20;
    const log = scaffoldRun({ x0, clients, localSteps, lr, rounds });
    const d = x0.length;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(log, -1, d),
        edges: [],
        description: `SCAFFOLD across ${clients.length} clients for ${rounds} rounds with ${localSteps} local steps each.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: log.length, cols: d, x: log[log.length - 1]?.x ?? x0 },
    };
    step += 1;
    for (let i = 0; i < log.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(log, i, d),
            edges: [],
            description: `Round ${log[i]?.round}: x = [${(log[i]?.x ?? []).map((v) => v.toFixed(3)).join(", ")}], objective ${(log[i]?.objective ?? 0).toFixed(4)}.`,
            codeLineNumber: i === 0 ? 2 : 6,
            layout: "grid",
            meta: { rows: log.length, cols: d, current: i, x: log[i]?.x ?? x0, objective: log[i]?.objective ?? 0 },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(log, log.length - 1, d),
        edges: [],
        description: `Done: server model [${(log[log.length - 1]?.x ?? []).map((v) => v.toFixed(3)).join(", ")}] after ${rounds} rounds.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: log.length, cols: d, x: log[log.length - 1]?.x ?? x0, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In federated learning each client trains on its own data, so local updates can drift in different directions and slow convergence. SCAFFOLD tracks a control variate on the server and one on every client that estimate this drift. Subtracting the client control and adding the server control removes the drift, so all clients effectively optimize the same global objective.",
        invariants: [
            "Each client takes local steps on gradient minus its control plus the server control.",
            "A client control is updated by subtracting the old server control and adding the scaled local displacement.",
            "The server model is the average of the client models and the server control accumulates the control changes.",
        ],
        correctness:
            "For quadratic client objectives the local loop applies the corrected gradient at every step. After the local steps the client control is updated as c_k minus c plus the displacement divided by the step size times local steps. The server averages the client models and adds the average control change. With homogeneous clients the control correction cancels the data terms and the iterates follow ordinary mini-batch gradient descent, a property the brute-force test checks by comparing against the analytic minimizer of the averaged quadratic.",
        complexityRationale:
            "Each of the rounds runs clients times localSteps gradient evaluations, each costing O(d^2) for a dense quadratic, so time is O(rounds * clients * localSteps * d^2). Storing one control vector per client uses O(clients * d) space.",
        uses: [
            "Federated learning with heterogeneous client data",
            "On-device training across many edge devices",
            "Variance reduction for distributed optimization",
        ],
        references: [
            "Karimireddy, Kale, Mohri, Reddi, Stich, and Suresh, SCAFFOLD: Stochastic Controlled Averaging for Federated Learning, ICML 2020",
            "Kairouz et al., Advances and Open Problems in Federated Learning, Foundations and Trends 2021",
        ],
        workedExample:
            "Three one-dimensional clients have objectives with minima at 1, 0, and -1, so the global optimum is 0. Starting at zero with local steps and a small learning rate, each client's corrected gradient pulls toward the shared global control, and after enough rounds the server average stays near zero instead of oscillating between client optima.",
    },
    id: "scaffold-federated",
    name: "SCAFFOLD Federated Optimization",
    category: "ml-ai",
    complexity: { time: "O(rounds * clients * tau * d^2)", space: "O(clients * d)" },
    defaultInput: {
        x0: [0],
        clients: [
            { H: [[2]], b: [2] },
            { H: [[4]], b: [0] },
            { H: [[2]], b: [-2] },
        ],
        localSteps: 3,
        lr: 0.1,
        rounds: 20,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize server model and server control to zero",
        "give every client a zero control variate",
        "for each communication round",
        "each client takes local steps on gradient minus its control plus server control",
        "each client updates its control from its local displacement",
        "server averages client models and adds the average control change",
        "done: report the trained server model",
    ],
};

export default module;
