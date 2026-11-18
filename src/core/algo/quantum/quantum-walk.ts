/**
 * quantum-walk.ts - Discrete-Time Quantum Walk on a Line (exact simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A discrete-time quantum walk spreads a particle along a line using a coin
 * and a conditional shift. At each site a Hadamard coin acts on a two-component
 * amplitude (left-moving and right-moving), then the left component steps one
 * site left and the right component steps one site right. Interference between
 * paths gives a distribution that is different from a classical random walk
 * and spreads linearly with the number of steps.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is a SMALL EXACT SIMULATOR with real amplitudes and an ideal Hadamard
 * coin, not a fault-tolerant quantum processor. It demonstrates the exact
 * state evolution of a one-dimensional walk over a handful of steps. Physical
 * implementations require qubits, coherent coin operations, and error
 * correction; no such claim is made here.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(t * positions) for t steps, at most O(t^2) total
 *   Space: O(t) for positions with nonzero amplitude
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the measurement probability at each position from -t to t.
 *   - Positions reached on the most recent step are yellow.
 *   - The final frame is green and reports the spread of the distribution.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Spinor = [number, number];
type WalkState = Map<number, Spinor>;

const INV_SQRT2 = Math.SQRT1_2;

function makeBars(
    positions: number[],
    probabilities: Map<number, number>,
    highlighted: Set<number>,
    finalState: boolean,
): VisualEntity[] {
    return positions.map((position, index) => {
        const probability = probabilities.get(position) ?? 0;
        return {
            id: `pos-${position}`,
            type: "bar" as const,
            label: String(position),
            value: probability,
            state: finalState ? "sorted" : highlighted.has(position) ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, position, probability },
        };
    });
}

/** One coin-then-shift step of the Hadamard walk. */
function advance(state: WalkState): WalkState {
    const next: WalkState = new Map();
    for (const [position, spinor] of state) {
        const left = spinor[0] ?? 0;
        const right = spinor[1] ?? 0;
        const coinLeft = (left + right) * INV_SQRT2;
        const coinRight = (left - right) * INV_SQRT2;
        const move = (target: number, component: 0 | 1, amplitude: number): void => {
            const existing = next.get(target) ?? [0, 0];
            existing[component] = (existing[component] ?? 0) + amplitude;
            next.set(target, existing);
        };
        move(position - 1, 0, coinLeft);
        move(position + 1, 1, coinRight);
    }
    return next;
}

/** Discrete-time quantum walk generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { steps?: number; initial?: string } | null) ?? {};
    const steps =
        typeof task.steps === "number" ? Math.max(0, Math.min(10, Math.floor(task.steps))) : 4;
    const initial = task.initial === "left" ? "left" : task.initial === "plus" ? "plus" : "right";
    let state: WalkState = new Map();
    if (initial === "right") state.set(0, [0, 1]);
    else if (initial === "left") state.set(0, [1, 0]);
    else state.set(0, [INV_SQRT2, INV_SQRT2]);

    const positions: number[] = [];
    for (let p = -steps; p <= steps; p += 1) positions.push(p);
    const probabilitiesOf = (current: WalkState): Map<number, number> => {
        const result = new Map<number, number>();
        for (const [position, spinor] of current) {
            result.set(position, (spinor[0] ?? 0) ** 2 + (spinor[1] ?? 0) ** 2);
        }
        return result;
    };
    const meta = (used: number, done: boolean) => {
        const probabilities = probabilitiesOf(state);
        let norm = 0;
        for (const value of probabilities.values()) norm += value;
        let spread = 0;
        for (const position of probabilities.keys()) spread = Math.max(spread, Math.abs(position));
        return {
            steps,
            step: used,
            initial,
            positions,
            probabilities: [...probabilities.entries()].flatMap(([position, probability]) => [position, probability]),
            norm,
            spread,
            done,
        };
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(positions, probabilitiesOf(state), new Set([0]), false),
        edges: [],
        description: `Start the walk at position 0 with the ${initial} coin state.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, false),
    };
    step += 1;

    for (let t = 1; t <= steps; t += 1) {
        const previous = state;
        state = advance(state);
        const reached = new Set<number>();
        for (const position of state.keys()) {
            if (!previous.has(position)) reached.add(position);
        }
        yield {
            stepNumber: step,
            entities: makeBars(positions, probabilitiesOf(state), reached, false),
            edges: [],
            description: `Step ${t}: Hadamard coin at every site, then left amplitudes move left and right amplitudes move right.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { ...meta(t, false), coin: "hadamard" },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(positions, probabilitiesOf(state), new Set(), true),
        edges: [],
        description: `After ${steps} step(s) the walk reaches positions within ${meta(steps, true).spread} of the origin with total probability ${meta(steps, true).norm.toFixed(10)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: meta(steps, true),
    };
}

/** The quantum walk module (exact small-step simulator). */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A classical walker flips a coin and moves left or right. A quantum walker carries two amplitudes, one for each direction, and a Hadamard coin blends them before the move. Because amplitudes can cancel or reinforce, some paths become more likely and others vanish, so the spread of the walk differs sharply from a classical random walk.",
        invariants: [
            "The total probability across all positions stays equal to one after every coin and shift.",
            "After t steps, only positions with the same parity as t (starting from the origin) can be reached.",
            "The Hadamard coin is unitary, so it preserves the norm of each site's spinor before the shift.",
        ],
        correctness:
            "The Hadamard matrix is unitary, so applying it to each spinor preserves its squared norm. The shift sends the left amplitude to position minus one and the right amplitude to position plus one, which merely relocates probability without creating or destroying it; amplitudes landing at the same site are added coherently. Therefore total probability is conserved at every step, and since each step changes position by exactly one, after t steps the support is contained in positions between minus t and t with the appropriate parity.",
        complexityRationale:
            "After t steps at most 2t plus one positions are occupied. Each step visits the occupied sites and does constant work per spinor, so the running total is O(t^2) and the live state uses O(t) space. This is a classical simulation; an actual quantum device would evolve the state coherently in O(t) coin and shift operations.",
        uses: [
            "Quantum algorithms for graph search and element distinctness",
            "Models of transport in quantum walks and lattice systems",
            "Demonstrations of interference and linear quantum spreading",
        ],
        references: [
            "Aharonov, Ambainis, Kempe, and Vazirani, Quantum Walks on Graphs, 2001",
            "Ambainis, Quantum Walk Algorithms, 2003",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 12",
        ],
        workedExample:
            "Starting with the right-moving coin at the origin, step one gives amplitudes that put probability one half at position minus one and one half at position one. Step two yields probabilities one quarter at minus two, one half at zero, and one quarter at two, with the origin regained by interference of the two incoming paths.",
    },
    id: "quantum-walk",
    name: "Quantum Walk",
    category: "quantum",
    complexity: { time: "O(t^2) classical simulation", space: "O(t)" },
    defaultInput: { steps: 4, initial: "right" },
    visualType: "array",
    run,
    pseudocode: [
        "place the initial spinor at the origin",
        "for each step apply the Hadamard coin at every occupied site",
        "send the left amplitude one site left and the right one site right",
        "add amplitudes coherently when two paths meet",
        "accumulate squared amplitudes into the probability distribution",
        "record the distribution after each step",
        "done: report the final spread and total probability",
    ],
};

export default module;
