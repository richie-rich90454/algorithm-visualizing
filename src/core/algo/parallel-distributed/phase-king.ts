/**
 * phase-king.ts - Phase-King Synchronous Consensus
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Phase-King solves consensus in a synchronous message-passing system with up
 * to f faulty processes. It runs f+1 phases. In each phase a rotating king
 * broadcasts its current estimate to all correct processes, and every correct
 * process adopts that value. Since f+1 phases include at least one phase whose
 * king is correct, all correct processes end up holding the same value. If
 * every correct process started from the same value, every correct king holds
 * that value, so agreement preserves validity. A faulty king is simply ignored.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(f) phases with O(n) broadcast messages each
 *   Space: O(n) per process for the current estimate and fault view
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are processes on a circle; the king's broadcast is highlighted.
 *   - GREEN marks the king, RED marks a faulty process, amber marks adoption.
 *   - meta carries the phase, king, estimates, and final decision.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

interface Input {
    processes?: number;
    values?: number[];
    faulty?: number[];
}

const defaultInput: Input = { processes: 4, values: [0, 1, 1, 0], faulty: [0] };

function nodePosition(i: number, n: number): [number, number] {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return [Math.round(180 * Math.cos(angle)), Math.round(180 * Math.sin(angle))];
}

function makeNodes(n: number, values: number[], faulty: boolean[], king: number, adopted: boolean): VisualEntity[] {
    return Array.from({ length: n }, (_, i) => {
        const [x, y] = nodePosition(i, n);
        const state: EntityState = faulty[i] ? "error" : i === king ? "active" : adopted ? "comparing" : "idle";
        return {
            id: `proc-${i}`,
            type: "node" as const,
            label: `P${i}`,
            value: faulty[i] ? "faulty" : values[i] ?? 0,
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { proc: i, estimate: values[i] ?? 0, faulty: !!faulty[i], king: i === king },
        };
    });
}

function makeEdges(n: number, king: number, faulty: boolean[]): VisualEdge[] {
    if (faulty[king]) return [];
    const edges: VisualEdge[] = [];
    for (let j = 0; j < n; j += 1) {
        if (j === king || faulty[j]) continue;
        edges.push({
            id: `king-${king}-${j}`,
            sourceId: `proc-${king}`,
            targetId: `proc-${j}`,
            label: String(king),
            state: "active",
            directed: true,
        });
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const n = Math.max(3, Math.min(7, Math.floor(task.processes ?? 4)));
    const faulty = Array.from({ length: n }, () => false);
    const faultList = Array.isArray(task.faulty) ? task.faulty : defaultInput.faulty ?? [];
    for (const f of faultList) {
        const idx = Math.max(0, Math.min(n - 1, Math.floor(f)));
        faulty[idx] = true;
    }
    const fCount = faulty.filter(Boolean).length;
    const rounds = fCount + 1;
    const values: number[] = Array.from({ length: n }, (_, i) => {
        const v = Array.isArray(task.values) ? task.values[i] : (defaultInput.values ?? [])[i];
        return v === 1 ? 1 : 0;
    });
    const correct: number[] = values.map((v, i) => (faulty[i] ? -1 : v));
    let step = 0;
    let decided = -1;

    const meta = (phase: number, king: number, adopted: boolean, last: string) => ({
        processes: n,
        faults: fCount,
        rounds,
        phase,
        king,
        estimates: values.map((v) => v),
        correct: correct.map((v) => v),
        decided,
        adopted,
        last,
    });

    yield {
        stepNumber: step++,
        entities: makeNodes(n, values, faulty, -1, false),
        edges: [],
        description: `Phase-King consensus: ${n} processes, ${fCount} faulty, ${rounds} phase(s). Start values ${values.join(", ")}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: meta(0, -1, false, "initialized"),
    };

    for (let phase = 0; phase < rounds; phase += 1) {
        const king = phase % n;
        const kingOk = !faulty[king];
        if (kingOk) {
            const kv = values[king] ?? 0;
            for (let i = 0; i < n; i += 1) {
                if (!faulty[i]) values[i] = kv;
            }
            correct.forEach((_, i) => {
                if (!faulty[i]) correct[i] = kv;
            });
        }
        const desc = kingOk
            ? `Phase ${phase}: correct king P${king} broadcasts ${values[king]}; all correct processes adopt it.`
            : `Phase ${phase}: king P${king} is faulty and ignored; correct processes keep their estimates.`;
        yield {
            stepNumber: step++,
            entities: makeNodes(n, values, faulty, king, kingOk),
            edges: makeEdges(n, king, faulty),
            description: desc,
            codeLineNumber: kingOk ? 3 : 2,
            layout: "point",
            meta: meta(phase + 1, king, kingOk, desc),
        };
    }

    const survivors = correct.filter((v) => v >= 0);
    decided = survivors.length > 0 ? survivors[0]! : 0;
    const allAgree = survivors.every((v) => v === decided);
    const done = allAgree
        ? `All ${survivors.length} correct processes decided ${decided} after ${rounds} phase(s).`
        : `Consensus failed to align (check fault assumptions); latest values ${values.join(", ")}.`;
    yield {
        stepNumber: step,
        entities: makeNodes(n, values, faulty, -1, false),
        edges: [],
        description: done,
        codeLineNumber: 5,
        layout: "point",
        meta: meta(rounds, -1, false, done),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Run several voting rounds, each led by a rotating king. When the king is honest, everybody copies its answer; when the king is faulty, everybody ignores it and waits for the next round. Because there are more rounds than possible faults, at least one round has an honest king, and after that everyone shares one answer that later honest kings can only keep the same.",
        invariants: [
            "A correct process changes its estimate only to a correct king's value.",
            "Once all correct processes agree, later phases preserve that agreement.",
            "At least one of the f+1 phases has a correct king.",
        ],
        correctness:
            "There are f+1 phases and at most f faulty processes, so by pigeonhole some phase has a correct king. In that phase every correct process adopts the king's estimate, so from that moment all correct processes hold the same value. Any later phase either has a faulty king (ignored, no change) or a correct king whose estimate is already the common value (adopted, still common). Hence agreement holds at the end. For validity, if all correct processes start from v, then every correct king holds v and every adoption writes v, so the decision is v. Termination is after exactly f+1 phases.",
        complexityRationale:
            "Each of the f+1 phases broadcasts one value to n-1 processes, so O(f * n) messages overall and O(n) per phase. Each process stores its estimate and its view of which processes are faulty, O(n) space.",
        uses: [
            "Reaching agreement in synchronous replicated state machines",
            "Coordinating redundant avionics or robotics controllers with faulty units",
            "A teaching bridge from consensus theory to practical leader-driven protocols",
        ],
        references: [
            "Berman, Garay, and Koutsopoulos, Phase King: Rapid Consensus with Optimal Resilience, 1989",
            "Lamport, Shostak, and Pease, The Byzantine Generals Problem, 1982",
        ],
        workedExample:
            "Four processes start [0, 1, 1, 0] and process 0 is faulty. With f=1 there are two phases. Phase 0's king is the faulty P0, so nothing changes. Phase 1's king is the correct P1 holding 1, so all correct processes adopt 1 and decide 1, even though they began with mixed values.",
    },
    id: "phase-king",
    name: "Phase-King Consensus",
    category: "parallel-distributed",
    complexity: { time: "O(f * n) messages", space: "O(n)" },
    defaultInput,
    visualType: "point",
    run,
    pseudocode: [
        "assume at most f faulty processes and n greater than 3f",
        "each correct process starts with an estimate",
        "for phase k from zero to f, king is process k modulo n",
        "if the king is correct, broadcast its estimate to all",
        "each correct process adopts the correct king's value",
        "if the king is faulty, keep the current estimate",
        "after f+1 phases all correct estimates coincide",
        "done: decide the common estimate",
    ],
};

export default module;
