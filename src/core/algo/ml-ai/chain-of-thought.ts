/**
 * chain-of-thought.ts - Chain-of-Thought Decomposition (Teachable Core)
 *
 * Chain-of-thought is a prompting/decoding strategy, not one fixed algorithm.
 * The teachable core shown here is sequential decomposition: solve a multi-step
 * arithmetic expression by writing each intermediate result, where every step
 * consumes the previous step's answer. This is the reasoning scaffold, not a
 * language model or a claim about model behavior.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Operation {
    op: "+" | "-" | "*" | "/";
    value: number;
}

export interface ThoughtStep {
    index: number;
    expression: string;
    value: number;
}

/** Apply a single arithmetic operation to an accumulator. */
export function applyOperation(current: number, operation: Operation): number {
    switch (operation.op) {
        case "+":
            return current + operation.value;
        case "-":
            return current - operation.value;
        case "*":
            return current * operation.value;
        case "/":
            if (operation.value === 0) {
                return current;
            }
            return current / operation.value;
    }
}

/** Decompose a starting value plus operations into explicit reasoning steps. */
export function decompose(start: number, operations: Operation[]): ThoughtStep[] {
    const steps: ThoughtStep[] = [{ index: 0, expression: `start = ${start}`, value: start }];
    let current = start;
    operations.forEach((operation, i) => {
        const next = applyOperation(current, operation);
        steps.push({
            index: i + 1,
            expression: `${current} ${operation.op} ${operation.value} = ${next}`,
            value: next,
        });
        current = next;
    });
    return steps;
}

function makeCells(steps: ThoughtStep[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        if (!step) {
            continue;
        }
        const fields = [String(step.index), step.expression, step.value.toFixed(3)];
        for (let c = 0; c < fields.length; c += 1) {
            const shown = i <= revealed;
            const state: EntityState = i === current ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${i}-${c}`,
                type: "cell",
                label: shown ? (fields[c] ?? "") : "?",
                value: shown ? (fields[c] ?? "") : "",
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: c },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { start?: number; operations?: Operation[] } | null
    ) ?? {};
    const start = typeof task.start === "number" ? task.start : 2;
    const operations: Operation[] = Array.isArray(task.operations)
        ? task.operations
        : [
              { op: "+", value: 3 },
              { op: "*", value: 4 },
              { op: "-", value: 5 },
              { op: "/", value: 3 },
          ];
    const steps = decompose(start, operations);
    const metaBase = { rows: steps.length, cols: 3 };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(steps, -1, -1),
        edges: [],
        description: `Decomposing a ${operations.length}-step expression into explicit intermediate results (the reasoning core of chain of thought).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, start },
    };
    step += 1;

    for (let i = 1; i < steps.length; i += 1) {
        const s = steps[i];
        yield {
            stepNumber: step,
            entities: makeCells(steps, i, i),
            edges: [],
            description: `Step ${i}: ${s?.expression ?? ""}; carry this answer into the next step.`,
            codeLineNumber: i === 1 ? 1 : 2,
            layout: "grid",
            meta: { ...metaBase, start, value: s?.value, values: steps.map((v) => v.value) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(steps, steps.length - 1, -1),
        edges: [],
        description: `Done: the chain of ${operations.length} steps yields ${(steps[steps.length - 1]?.value ?? start).toFixed(3)}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...metaBase, start, final: steps[steps.length - 1]?.value, values: steps.map((v) => v.value), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than jumping to an answer, chain of thought writes down each intermediate result so the next step can build on it. Each line consumes the previous line's output, turning one hard multi-step problem into a chain of easy single-step problems. The visualization shows that carried state explicitly.",
        invariants: [
            "Step zero is the given starting value.",
            "Each later step's value is the previous value with one operation applied.",
            "The final value is the value carried out of the last step.",
        ],
        correctness:
            "By induction, step k holds the result of applying the first k operations to the start, because step k is defined as one operation applied to step k-1. A direct fold over the same operation list must produce the same final value, so the decomposition is sound and the intermediate trace is exactly the fold's sequence of accumulators.",
        complexityRationale:
            "One frame per operation gives O(m) time and O(m) stored steps for m operations, each step doing constant arithmetic work.",
        uses: [
            "Stepwise arithmetic and word-problem solving in language models",
            "Making intermediate reasoning inspectable and debuggable",
            "Teaching decomposition of a compound task into dependent subtasks",
        ],
        references: [
            "Wei et al., Chain-of-Thought Prompting Elicits Reasoning in Large Language Models, NeurIPS 2022",
            "Kojima et al., Large Language Models are Zero-Shot Reasoners, NeurIPS 2022",
        ],
        workedExample:
            "Starting from 2, the operations +3, *4, -5, /3 produce the intermediate values 5, 20, 15, and 5. Each line is one small, checkable step, and the last carried value 5 matches computing the whole expression directly.",
    },
    id: "chain-of-thought",
    name: "Chain of Thought",
    category: "ml-ai",
    complexity: { time: "O(m)", space: "O(m)" },
    defaultInput: {
        start: 2,
        operations: [
            { op: "+", value: 3 },
            { op: "*", value: 4 },
            { op: "-", value: 5 },
            { op: "/", value: 3 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "record the starting value as step zero",
        "for each operation in the expression",
        "apply it to the previous step's value",
        "record the new value as the next reasoning step",
        "carry that value into the following step",
        "done: report the final carried value",
    ],
};

export default module;
