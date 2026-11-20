/**
 * work-stealing-scheduler.ts - Work-Stealing Scheduler (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a work-stealing scheduler each worker owns a double-ended queue of ready
 * tasks. The owner pushes and pops tasks at one end (the bottom), while an
 * idle worker steals from the opposite end (the top) of a randomly chosen
 * victim. Because the two ends are used for different operations, an owner and
 * a thief rarely contend for the same task. A task that spawns children leaves
 * them on its own deque, so the work naturally spreads to idle processors
 * without a central queue.
 *
 * This is a deterministic discrete-event teaching simulation. It models deque
 * ownership, steal-from-the-other-end behavior, load balancing, and makespan.
 * It does not model real threads, cache effects, or memory consistency.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T + p * s) for T total task steps, p workers, and s steal events
 *   Space: O(n + p) for n queued tasks and p worker deques
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each worker is a node; its deque length is shown in the label.
 *   - Task execution turns a worker green, stealing turns the pair yellow.
 *   - meta carries per-worker deques, steal events, and the makespan.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

export interface Execution {
    task: number;
    worker: number;
    start: number;
    end: number;
    stolen: boolean;
}

export interface StealEvent {
    tick: number;
    thief: number;
    victim: number;
    task: number;
}

export interface WorkStealingResult {
    workers: number;
    ticks: number;
    executions: Execution[];
    steals: StealEvent[];
    complete: boolean;
    totalWork: number;
}

interface Task {
    id: number;
    size: number;
}

interface WorkerState {
    deque: number[];
    current: Task | null;
    remaining: number;
}

/** Deterministic work-stealing simulation of independent sized tasks. */
export function simulateWorkStealing(
    taskSizes: number[],
    workerCount: number,
    seed: number,
): WorkStealingResult {
    const p = Math.max(1, Math.floor(workerCount));
    const sizes = taskSizes.length > 0 ? [...taskSizes] : [3, 2, 4, 1, 5, 2, 3, 1];
    const tasks = new Map<number, Task>(sizes.map((size, id) => [id, { id, size: Math.max(1, Math.floor(size)) }]));
    const totalWork = [...tasks.values()].reduce((sum, task) => sum + task.size, 0);
    const workers: WorkerState[] = Array.from({ length: p }, () => ({ deque: [], current: null, remaining: 0 }));
    sizes.forEach((_, id) => workers[0]?.deque.push(id));

    const executions: Execution[] = [];
    const steals: StealEvent[] = [];
    const running = new Map<number, Execution>();
    let state = seed >>> 0;
    const random = (): number => {
        state = (state * 1103515245 + 12345) >>> 0;
        return state / 4294967296;
    };

    const maxTicks = totalWork + sizes.length * 2 + 2 * p + 10;
    let tick = 0;
    while (tick < maxTicks) {
        for (let w = 0; w < p; w += 1) {
            const worker = workers[w] as WorkerState;
            if (!worker.current) {
                continue;
            }
            worker.remaining -= 1;
            if (worker.remaining <= 0) {
                const record = running.get(w);
                if (record) {
                    record.end = tick;
                }
                running.delete(w);
                worker.current = null;
            }
        }

        for (let w = 0; w < p; w += 1) {
            const worker = workers[w] as WorkerState;
            if (worker.current) {
                continue;
            }
            let id: number | undefined;
            let stolen = false;
            if (worker.deque.length > 0) {
                id = worker.deque.pop();
            } else {
                const candidates: number[] = [];
                for (let v = 0; v < p; v += 1) {
                    if (v !== w && (workers[v] as WorkerState).deque.length > 0) {
                        candidates.push(v);
                    }
                }
                if (candidates.length > 0) {
                    const victim = candidates[Math.floor(random() * candidates.length)] as number;
                    id = (workers[victim] as WorkerState).deque.shift();
                    stolen = true;
                    steals.push({ tick, thief: w, victim, task: id as number });
                }
            }
            if (id !== undefined) {
                const task = tasks.get(id) as Task;
                worker.current = task;
                worker.remaining = task.size;
                const record: Execution = { task: id, worker: w, start: tick, end: -1, stolen };
                executions.push(record);
                running.set(w, record);
            }
        }

        tick += 1;
        const anyLeft = workers.some((worker) => worker.current !== null || worker.deque.length > 0);
        if (!anyLeft) {
            break;
        }
    }

    for (const execution of executions) {
        if (execution.end < 0) {
            execution.end = tick;
        }
    }
    const complete = executions.length === sizes.length && new Set(executions.map((execution) => execution.task)).size === sizes.length;
    return { workers: p, ticks: tick, executions, steals, complete, totalWork };
}

/** Node entities for one frame: workers plus their current deque lengths. */
function makeNodes(
    workerCount: number,
    deques: number[][],
    active: Map<number, boolean>,
    stealPair: [number, number] | null,
): VisualEntity[] {
    return Array.from({ length: workerCount }, (_, index) => {
        let state: EntityState = deques[index]?.length ? "idle" : "unvisited";
        if (active.get(index)) {
            state = "sorted";
        }
        if (stealPair && (stealPair[0] === index || stealPair[1] === index)) {
            state = "comparing";
        }
        const queue = deques[index] ?? [];
        return {
            id: `worker-${index}`,
            type: "node" as const,
            label: `W${index} q=${queue.length}`,
            value: index,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "worker", index, queue: queue.join(","), busy: active.get(index) ?? false },
        };
    });
}

/** The work-stealing generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { tasks?: number[]; workers?: number; seed?: number } | null) ?? {};
    const tasks = Array.isArray(task.tasks) && task.tasks.length > 0 ? [...task.tasks] : [3, 2, 4, 1, 5, 2, 3, 1];
    const workerCount = typeof task.workers === "number" ? Math.max(1, Math.floor(task.workers)) : 4;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const result = simulateWorkStealing(tasks, workerCount, seed);
    const stealCount = result.steals.length;

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeNodes(workerCount, [tasks.map((_, index) => index), ...Array.from({ length: workerCount - 1 }, () => [])], new Map(), null),
        edges: [],
        description: `Work-stealing with ${workerCount} workers and ${tasks.length} tasks (total work ${result.totalWork}); all work starts on worker 0.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { workers: workerCount, tasks: tasks.length, ticks: 0, steals: 0, makespan: 0, complete: false },
    };

    const deques: number[][] = Array.from({ length: workerCount }, () => []);
    tasks.forEach((_, index) => deques[0]?.push(index));
    const active = new Map<number, boolean>();

    for (const execution of result.executions) {
        active.set(execution.worker, true);
        const steal = execution.stolen ? result.steals.find((event) => event.task === execution.task) : undefined;
        if (steal) {
            const victimQueue = deques[steal.victim] ?? [];
            const index = victimQueue.indexOf(execution.task);
            if (index >= 0) {
                victimQueue.splice(index, 1);
            }
        } else {
            const ownerQueue = deques[execution.worker] ?? [];
            const index = ownerQueue.indexOf(execution.task);
            if (index >= 0) {
                ownerQueue.splice(index, 1);
            }
        }
        const stealPair: [number, number] | null = steal ? [steal.thief, steal.victim] : null;
        yield {
            stepNumber: step++,
            entities: makeNodes(workerCount, deques, active, stealPair),
            edges: stealPair
                ? [{
                    id: `steal-${execution.task}`,
                    sourceId: `worker-${stealPair[0]}`,
                    targetId: `worker-${stealPair[1]}`,
                    label: "steal",
                    state: "active",
                    directed: true,
                }]
                : [],
            description: execution.stolen
                ? `Worker ${execution.worker} steals task ${execution.task} from the top of worker ${steal?.victim}'s deque.`
                : `Worker ${execution.worker} pops task ${execution.task} from the bottom of its own deque.`,
            codeLineNumber: execution.stolen ? 4 : 2,
            layout: "graph",
            meta: { workers: workerCount, tasks: tasks.length, ticks: 0, steals: stealCount, task: execution.task, worker: execution.worker, makespan: result.ticks, complete: false },
        };
        active.set(execution.worker, false);
    }

    yield {
        stepNumber: step,
        entities: makeNodes(workerCount, deques, new Map(), null),
        edges: [],
        description: `Completed ${tasks.length} task(s) in ${result.ticks} tick(s) with ${stealCount} steal(s); makespan ${result.ticks}.`,
        codeLineNumber: 7,
        layout: "graph",
        meta: {
            workers: workerCount,
            tasks: tasks.length,
            steals: stealCount,
            makespan: result.ticks,
            complete: result.complete,
            totalWork: result.totalWork,
            stealEvents: result.steals.map((event) => `${event.thief}->${event.victim}:${event.task}@${event.tick}`),
            note: "teaching model: discrete-event deque simulation, not real threads",
        },
    };
}

/** The work-stealing scheduler module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Give every worker its own queue of ready tasks. When a worker finishes its own work it does not sit idle: it picks another worker and steals a task from the far end of that worker's queue. Because owners work at one end and thieves take from the other, the two rarely collide. Busy workers keep executing while idle ones hunt for work, which evens out the load automatically.",
        invariants: [
            "A task is executed exactly once, by its owner or by one thief.",
            "The owner pushes and pops at the bottom; a thief removes from the top.",
            "A worker steals only from a victim whose deque is nonempty and is not itself.",
        ],
        correctness:
            "Each task begins in exactly one deque and is removed by exactly one pop or one steal before execution, so it runs once and no work is duplicated or lost. The victim is chosen only among nonempty deques other than the thief's own, so a steal always makes progress. Stealing from the opposite end means the owner and a thief touch different tasks whenever the deque holds more than one item, preserving the owner's locality while idle processors gain work. When all deques and current tasks are empty, every task has completed.",
        complexityRationale:
            "Each task runs for its size in ticks, so execution accounts for O(T) work where T is the total task size. At an idle tick a thief scans p workers to find victims, giving O(T + p * s) time for s steal events; the p deques hold at most n tasks, so space is O(n + p).",
        uses: [
            "Runtime task schedulers such as Cilk and Go work-stealing runtimes",
            "Parallel fork-join frameworks including Java ForkJoinPool",
            "Load balancing in ray tracing and game engine job systems",
        ],
        references: [
            "Blumofe and Leiserson, Scheduling Multithreaded Computations by Work Stealing, 1999",
            "Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 12",
        ],
        workedExample:
            "With four workers and tasks of sizes 3, 2, 4, 1, 5, 2, 3, 1 all queued on worker 0, the first worker pops size 1 from the bottom while an idle worker steals size 3 from the top. As tasks finish, more thieves take from worker 0's deque until all four workers are busy; the simulation ends when every task has run once.",
    },
    id: "work-stealing-scheduler",
    name: "Work-Stealing Scheduler",
    category: "parallel-distributed",
    complexity: { time: "O(T + p*s)", space: "O(n + p)" },
    defaultInput: { tasks: [3, 2, 4, 1, 5, 2, 3, 1], workers: 4, seed: 7 },
    visualType: "graph",
    run,
    pseudocode: [
        "place all ready tasks on the owner worker's deque",
        "each worker pops from the bottom of its own deque",
        "execute the task for its full work size",
        "an idle worker picks a random victim with a nonempty deque",
        "steal a task from the top of that victim's deque",
        "record the steal and execute the stolen task",
        "repeat until no deque and no worker holds a task",
        "done: report assignments, steals, and makespan",
    ],
};

export default module;
