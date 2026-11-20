/**
 * banker-algorithm-distributed.ts - Distributed Banker's Safety Algorithm
 *
 * Each site reports its allocation and maximum claim to a resource manager,
 * which computes Need = Max - Allocation and runs the safety test: repeatedly
 * pick a process whose Need fits the currently available work vector and add
 * its allocation back. A tentative request is granted only if the state that
 * would result is still safe.
 *
 * Time:  O(n^2 * m) for the safety scan; request checks add O(n * m)
 * Space: O(n * m) for the need and allocation matrices
 *
 * Visualization: a grid shows the Need matrix with a trailing Work row; the
 * chosen process row glows, and the final frame reports the safe sequence.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Request = { process: number; needs: number[] };

type Safety = { safe: boolean; sequence: number[]; work: number[] };

/** Pure safety test, exported so an independent brute force can check it. */
export function bankersSafety(need: number[][], allocation: number[][], available: number[], n: number, m: number): Safety {
    const work = available.slice(0, m);
    const finish = new Array<boolean>(n).fill(false);
    const sequence: number[] = [];
    for (;;) {
        let found = -1;
        for (let p = 0; p < n; p += 1) {
            if (finish[p]) continue;
            let fits = true;
            for (let r = 0; r < m; r += 1) {
                if ((need[p]?.[r] ?? 0) > (work[r] ?? 0)) {
                    fits = false;
                    break;
                }
            }
            if (fits) {
                found = p;
                break;
            }
        }
        if (found < 0) break;
        for (let r = 0; r < m; r += 1) {
            work[r] = (work[r] ?? 0) + (allocation[found]?.[r] ?? 0);
        }
        finish[found] = true;
        sequence.push(found);
    }
    return { safe: sequence.length === n, sequence, work };
}

/** Grid cells for the Need matrix plus a final Work row. */
function makeCells(
    need: number[][],
    work: number[],
    n: number,
    m: number,
    active: number | null,
    finished: Set<number>,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row <= n; row += 1) {
        for (let col = 0; col < m; col += 1) {
            const isWork = row === n;
            const value = isWork ? (work[col] ?? 0) : (need[row]?.[col] ?? 0);
            const state: EntityState = isWork
                ? "highlight"
                : active === row
                    ? "comparing"
                    : finished.has(row)
                        ? "sorted"
                        : "idle";
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, kind: isWork ? "work" : "need" },
            });
        }
    }
    return cells;
}

/** The distributed banker's algorithm generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        processes?: string[];
        allocation?: number[][];
        max?: number[][];
        available?: number[];
        request?: Request;
    } | null) ?? {};
    const processes: string[] = Array.isArray(task.processes) && task.processes.length > 0
        ? task.processes.map(String)
        : ["P0", "P1", "P2", "P3", "P4"];
    const n = processes.length;
    const defaultAllocation = [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]];
    const defaultMax = [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]];
    const allocation: number[][] = Array.isArray(task.allocation)
        ? task.allocation.map((r) => Array.isArray(r) ? r.map((v) => Number(v) || 0) : [])
        : defaultAllocation;
    const maximum: number[][] = Array.isArray(task.max)
        ? task.max.map((r) => Array.isArray(r) ? r.map((v) => Number(v) || 0) : [])
        : defaultMax;
    const available: number[] = Array.isArray(task.available) ? task.available.map((v) => Number(v) || 0) : [3, 3, 2];
    const m = available.length;
    const need: number[][] = [];
    for (let p = 0; p < n; p += 1) {
        need.push(Array.from({ length: m }, (_, r) => Math.max(0, (maximum[p]?.[r] ?? 0) - (allocation[p]?.[r] ?? 0))));
    }
    const request = task.request;
    let step = 0;
    let decision = "none";
    let tentative: { allocation: number[][]; need: number[][]; available: number[] } | null = null;

    yield {
        stepNumber: step,
        entities: makeCells(need, available, n, m, null, new Set()),
        edges: [],
        description: `Resource manager collected ${n} site claims over ${m} resource types and computed Need = Max - Allocation.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n + 1, cols: m, processes, need: need.map((row) => row.join(",")), available, decision: "pending", sequence: [], safe: false },
    };
    step += 1;

    if (request && Number.isInteger(request.process) && request.process >= 0 && request.process < n) {
        const p = request.process;
        const withinNeed = request.needs.every((v, r) => v <= (need[p]?.[r] ?? 0));
        const withinAvailable = request.needs.every((v, r) => v <= (available[r] ?? 0));
        if (withinNeed && withinAvailable) {
            const allocCopy = allocation.map((r) => r.slice());
            const needCopy = need.map((r) => r.slice());
            const availCopy = available.slice();
            request.needs.forEach((v, r) => {
                allocCopy[p]![r] = (allocCopy[p]?.[r] ?? 0) + v;
                needCopy[p]![r] = (needCopy[p]?.[r] ?? 0) - v;
                availCopy[r] = (availCopy[r] ?? 0) - v;
            });
            tentative = { allocation: allocCopy, need: needCopy, available: availCopy };
            decision = "testing";
        } else {
            decision = "denied";
        }
        yield {
            stepNumber: step,
            entities: makeCells(need, available, n, m, p, new Set()),
            edges: [],
            description: `Site ${processes[p]} requests [${request.needs.join(", ")}]: ${decision === "denied" ? "exceeds its claim or the available resources" : "tentatively granted, now testing safety"}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: n + 1, cols: m, processes, need: need.map((row) => row.join(",")), available, decision, sequence: [], safe: false, request: request ? `${request.process}:${request.needs.join(",")}` : "" },
        };
        step += 1;
    }

    const state = tentative ?? { allocation, need, available };
    const work = state.available.slice();
    const finish = new Set<number>();
    const sequence: number[] = [];
    for (;;) {
        let found = -1;
        for (let p = 0; p < n; p += 1) {
            if (finish.has(p)) continue;
            let fits = true;
            for (let r = 0; r < m; r += 1) {
                if ((state.need[p]?.[r] ?? 0) > (work[r] ?? 0)) {
                    fits = false;
                    break;
                }
            }
            if (fits) {
                found = p;
                break;
            }
        }
        if (found < 0) break;
        for (let r = 0; r < m; r += 1) {
            work[r] = (work[r] ?? 0) + (state.allocation[found]?.[r] ?? 0);
        }
        finish.add(found);
        sequence.push(found);
        yield {
            stepNumber: step,
            entities: makeCells(state.need, work, n, m, found, finish),
            edges: [],
            description: `Process ${processes[found]} fits the work vector; add its allocation back, giving Work = [${work.join(", ")}].`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: n + 1,
                cols: m,
                processes,
                need: state.need.map((row) => row.join(",")),
                available: state.available,
                work: work.slice(),
                decision,
                sequence: [...sequence],
                safe: false,
            },
        };
        step += 1;
    }

    const safe = sequence.length === n;
    if (request && decision !== "denied") decision = safe ? "granted" : "denied";
    else if (decision === "testing") decision = safe ? "granted" : "denied";
    if (decision === "none") decision = safe ? "safe" : "unsafe";

    yield {
        stepNumber: step,
        entities: makeCells(state.need, work, n, m, null, finish),
        edges: [],
        description: safe
            ? `State is safe: sequence ${sequence.map((p) => processes[p]).join(" -> ")} can all finish.`
            : `State is unsafe: only ${sequence.length} of ${n} process(es) can finish.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: n + 1,
            cols: m,
            processes,
            need: state.need.map((row) => row.join(",")),
            available: state.available,
            work,
            decision,
            sequence: sequence.map((p) => processes[p]),
            safe,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A resource manager would rather refuse a request than let the system enter a state it cannot recover from. The banker's algorithm asks a hypothetical question: is there an order in which every process can still obtain its remaining needs and finish? It finds such an order by repeatedly giving the available resources to a process whose need fits, then reclaiming that process's allocation.",
        invariants: [
            "Need equals Max minus Allocation for every process and resource type.",
            "The work vector starts at Available and only grows as processes finish.",
            "A process is added to the safe sequence only when its entire Need fits the work vector.",
        ],
        correctness:
            "If the scan produces a full sequence, following it lets each process finish and return its allocation, so every process can complete: the state is safe. Conversely, if the scan stops with unfinished processes, each of them needs more than the final work vector can supply, and no other process can increase that vector, so no completion order exists and the state is unsafe. Testing a request on the tentative state therefore grants it exactly when the resulting state remains safe.",
        complexityRationale:
            "Each pass scans up to n processes and m resource types, and at most n processes are added, giving O(n^2 * m) time for the safety test. The matrices Need and Allocation dominate storage at O(n * m) space.",
        uses: [
            "Admission control in distributed resource managers",
            "Deadlock avoidance in operating-system kernel resource allocation",
            "Capacity checks before granting batch or cluster jobs",
        ],
        references: [
            "Dijkstra, The Hazard of Deadlock, 1965",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Deadlock Avoidance chapter",
        ],
        workedExample:
            "With Need rows [7,4,3], [1,2,2], [6,0,0], [0,1,1], [4,3,1] and Available [3,3,2], process P1 fits first, raising Work to [5,3,2]. Then P3, P0, P2, and P4 fit in turn, producing the safe sequence P1, P3, P0, P2, P4, so the state is safe.",
    },
    id: "banker-algorithm-distributed",
    name: "Distributed Banker's Algorithm",
    category: "parallel-distributed",
    complexity: { time: "O(n^2 m)", space: "O(n m)" },
    defaultInput: {
        processes: ["P0", "P1", "P2", "P3", "P4"],
        allocation: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
        max: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
        available: [3, 3, 2],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "collect allocation max and available from every site",
        "compute need as max minus allocation for each process",
        "if a request arrives verify it fits need and available",
        "set work to available and mark no process finished",
        "find an unfinished process whose need fits work",
        "if found add its allocation to work and mark finished",
        "if none found stop early with an unsafe state",
        "done: report the safe sequence and the request decision",
    ],
};

export default module;
