/**
 * gradecast.ts - Graded Broadcast
 *
 * Graded broadcast lets a sender distribute a value while each receiver also
 * gets a grade expressing how confident it should be. A grade of two means the
 * value is safe to decide on, grade one means it is consistent with any grade
 * two held elsewhere, and grade zero means the sender may be faulty.
 *
 * This teaching simulation uses a simple quorum rule. Every process collects
 * one reported value per participant; a value seen at least n-f times gets
 * grade two, one seen at least n-2f times gets grade one, otherwise grade zero.
 * Byzantine processes are modeled as reporting a single chosen value.
 *
 * Limits: a single round, a static Byzantine set, and deterministic messages;
 * this is not a full asynchronous gradecast protocol.
 *
 * Time: O(n^2) to tally messages. Space: O(n).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    outputs: Array<{ value: number; grade: number; count: number }>,
    active: number,
): VisualEntity[] {
    return outputs.map((out, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: `P${index}:v${out.value},g${out.grade}`,
        value: out.count,
        state: index === active ? ("active" as const) : (out.grade === 2 ? ("sorted" as const) : ("idle" as const)),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value: out.value, grade: out.grade, count: out.count, row: 0, col: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { inputs?: number[]; faults?: number; byzantineValue?: number }
        | null
    ) ?? {};
    const inputs: number[] = task.inputs ?? [1, 1, 1, 1];
    const n = inputs.length;
    const f = Math.max(0, Math.min(n, Math.floor(Number(task.faults ?? 0))));
    const byzantineValue = Number(task.byzantineValue ?? 0);
    const quorum2 = n - f;
    const quorum1 = n - 2 * f;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([], -1),
        edges: [],
        description: `Run graded broadcast with ${n} processes and up to ${f} faulty sender(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, f, quorum2, quorum1, inputs: inputs.slice() },
    };
    step += 1;

    if (n === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "There are no processes, so there is nothing to broadcast.",
            codeLineNumber: 6,
            layout: "grid",
            meta: { valid: false },
        };
        return;
    }

    const outputs: Array<{ value: number; grade: number; count: number }> = [];
    for (let i = 0; i < n; i += 1) {
        const reports: number[] = inputs.map((value, j) => (j < f ? byzantineValue : value));
        const counts = new Map<number, number>();
        for (const value of reports) {
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        let bestValue = reports[0] as number;
        let bestCount = 0;
        for (const [value, count] of counts) {
            if (count > bestCount || (count === bestCount && value < bestValue)) {
                bestValue = value;
                bestCount = count;
            }
        }
        const grade = bestCount >= quorum2 ? 2 : bestCount >= quorum1 && quorum1 > 0 ? 1 : 0;
        outputs.push({ value: bestValue, grade, count: bestCount });
        yield {
            stepNumber: step,
            entities: makeCells(outputs, i),
            edges: [],
            description: `Process ${i} tallied ${bestCount} vote(s) for value ${bestValue}, assigning grade ${grade}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                process: i,
                value: bestValue,
                grade,
                count: bestCount,
                reports: reports.slice(),
            },
        };
        step += 1;
    }

    const gradeTwoValues = new Set(outputs.filter((o) => o.grade === 2).map((o) => o.value));
    const gradedAgreement = gradeTwoValues.size <= 1;
    const allAgree = outputs.every((o) => o.value === (outputs[0] as { value: number }).value);
    yield {
        stepNumber: step,
        entities: makeCells(outputs, -1),
        edges: [],
        description: `Broadcast finished; grade-two values ${[...gradeTwoValues].join(", ") || "none"} and agreement holds: ${gradedAgreement}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            outputs,
            gradeTwoValues: [...gradeTwoValues],
            gradedAgreement,
            unanimous: allAgree,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain broadcast gives a receiver a value but no clue whether the sender lied to somebody else. Graded broadcast adds a confidence score. If almost everyone reports the same value, a receiver can safely decide; if reports are split, the grade warns that the sender may be faulty. The grade is what lets higher-level protocols distinguish a safe decision from a merely plausible one.",
        invariants: [
            "Every process tallies exactly one reported value per participant.",
            "A grade of two is assigned only when a value reaches the n minus f quorum.",
            "All grade-two outputs, if any, carry the same value in this quorum model.",
        ],
        correctness:
            "If the sender is honest, all honest processes report the same value v and it collects at least n-f votes, so every honest process outputs grade two with v. If an honest process outputs grade two for v, at least n-f participants reported v, and since at most f are faulty, any other process sees v from a majority of honest participants and cannot assign a higher grade to a different value; the single grade-two value set confirms this. The simulation checks the graded-agreement condition directly.",
        complexityRationale:
            "Each of the n processes tallies n reports with a constant-size map, so the work is O(n^2) time; only the current tally and outputs are stored, giving O(n) space.",
        uses: [
            "Building blocks for Byzantine agreement and consensus",
            "Reliable value dissemination in distributed ledgers",
            "Fault-tolerant state machine replication prerequisites",
        ],
        references: [
            "Feldman and Micali, Byzantine Agreement in Expected Polynomial Time, 1989",
            "Lamport, Shostak and Pease, The Byzantine Generals Problem, ACM TOPLAS 1982",
        ],
        workedExample:
            "With four processes, one faulty sender reporting 0 and three honest sources reporting 1, an honest process sees three votes for 1 and one for 0. The quorum is 3, so it outputs value 1 with grade two, which every honest process also reaches.",
    },
    id: "gradecast",
    name: "Graded Broadcast",
    category: "parallel-distributed",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { inputs: [1, 1, 1, 1], faults: 0, byzantineValue: 0 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the reported values and the fault count",
        "set the grade-two quorum to n minus f and grade-one quorum to n minus two f",
        "for each process tally all reported values",
        "choose the value with the most reports",
        "assign grade two, one or zero from the tally",
        "check that all grade-two outputs agree",
        "report the outputs and the agreement verdict",
    ],
};

export default module;
