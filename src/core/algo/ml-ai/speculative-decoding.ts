/**
 * speculative-decoding.ts - Greedy Speculative Decoding Verification
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Speculative decoding speeds up autoregressive generation with a cheap draft
 * model. The draft proposes several future tokens; the target model verifies
 * them in one pass and keeps the longest prefix that agrees with its own greedy
 * choice. On the first disagreement the target's token replaces the draft token
 * and the rest of the draft is discarded. Under greedy decoding this is exact:
 * every accepted token is provably the target model's top token, so the emitted
 * sequence equals plain greedy decoding. This module implements that exact
 * greedy verification core with a deterministic target model supplied as a
 * transition table. It is not a full sampler and uses no neural networks.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(k) verifier checks for a draft of k tokens
 *   Space: O(k) for the proposed and accepted token sequences
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each bar is a token; green bars are accepted, a red bar was rejected.
 *   - Gray bars after a rejection are discarded draft tokens.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SpeculativeInput {
    start?: number;
    draft?: number[];
    transitions?: Record<string, number>;
}

function makeBars(
    draft: number[],
    decided: number,
    accepted: boolean[],
    rejected: number,
): VisualEntity[] {
    return draft.map((token, index) => {
        let state: EntityState = "unvisited";
        if (index < decided) {
            state = accepted[index] ? "sorted" : "error";
        } else if (index === rejected) {
            state = "comparing";
        } else if (rejected >= 0 && index > rejected) {
            state = "idle";
        }
        return {
            id: `token-${index}`,
            type: "bar" as const,
            label: String(token),
            value: token,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, token, accepted: accepted[index] ?? false },
        };
    });
}

/** Verify a draft greedily against a deterministic target transition table. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SpeculativeInput | null) ?? {};
    const start = typeof task.start === "number" ? Math.trunc(task.start) : 0;
    const draft: number[] = Array.isArray(task.draft) ? task.draft.map((t) => Math.trunc(t)) : [3, 5, 2, 7];
    const transitions: Record<string, number> =
        task.transitions && typeof task.transitions === "object"
            ? task.transitions
            : { "0": 3, "3": 5, "5": 6, "6": 8, "8": 1 };

    let current = start;
    const accepted: boolean[] = new Array<boolean>(draft.length).fill(false);
    const output: number[] = [];
    let rejected = -1;
    let decided = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(draft, 0, accepted, -1),
        edges: [],
        description: `Draft proposed ${draft.length} tokens; the target model will verify them in one parallel pass.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { start, draft: draft.slice(), output: [], acceptedCount: 0, rejected: false, done: false },
    };

    let step = 1;
    for (let i = 0; i < draft.length; i += 1) {
        const expected = transitions[String(current)] ?? 0;
        const proposal = draft[i] ?? 0;
        const agrees = proposal === expected;
        if (agrees) {
            accepted[i] = true;
            output.push(proposal);
            current = proposal;
            decided = i + 1;
            yield {
                stepNumber: step,
                entities: makeBars(draft, decided, accepted, -1),
                edges: [],
                description: `Token ${i}: draft ${proposal} equals the target's next token ${expected}, so it is accepted.`,
                codeLineNumber: 3,
                layout: "array",
                meta: {
                    start,
                    draft: draft.slice(),
                    output: output.slice(),
                    acceptedCount: output.length,
                    rejected: false,
                    done: false,
                    expected,
                    proposal,
                },
            };
        } else {
            rejected = i;
            decided = i + 1;
            output.push(expected);
            current = expected;
            yield {
                stepNumber: step,
                entities: makeBars(draft, decided, accepted, rejected),
                edges: [],
                description: `Token ${i}: draft ${proposal} differs from the target's next token ${expected}, so accept ${expected} and discard the remaining draft.`,
                codeLineNumber: 5,
                layout: "array",
                meta: {
                    start,
                    draft: draft.slice(),
                    output: output.slice(),
                    acceptedCount: output.length - 1,
                    rejected: true,
                    done: false,
                    expected,
                    proposal,
                },
            };
            step += 1;
            break;
        }
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(draft, draft.length, accepted, rejected),
        edges: [],
        description: `Done: emitted ${output.length} token(s) ${JSON.stringify(output)}, identical to target greedy decoding.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            start,
            draft: draft.slice(),
            output: output.slice(),
            acceptedCount: accepted.filter(Boolean).length,
            rejected: rejected >= 0,
            done: true,
        },
    };
}

/** The greedy speculative decoding module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A small draft model guesses several tokens ahead, and the large target model checks the whole guess at once. It keeps every draft token that matches what it would have chosen itself, then fixes the first wrong token with its own choice and throws away the rest. Because a kept token is exactly the target's greedy pick, the final string is the same as slow token-by-token decoding, just verified in fewer passes.",
        invariants: [
            "Verification scans draft tokens strictly in order and stops at the first mismatch.",
            "Every accepted token equals the target model's greedy next token at that position.",
            "After a rejection, no later draft token can appear in the output.",
        ],
        correctness:
            "Let f be the target's greedy transition. At step i the verifier has current token c equal to the target's output after i accepted tokens. If the draft token equals f(c) it is accepted and c advances exactly as greedy decoding would; otherwise f(c) is emitted and the draft stops. By induction the emitted prefix always equals the target's greedy prefix, and the first mismatch makes that true for the whole output, so the result is exactly plain greedy decoding.",
        complexityRationale:
            "The verifier performs one table lookup per draft token until the first rejection, so time is O(k) for a draft of length k and at most O(k) tokens are stored. A real system pays one target forward pass to score all k tokens, which is where the wall-clock saving comes from.",
        uses: [
            "Accelerating large language model inference without changing outputs",
            "Serving assistants under tight latency budgets",
            "Teaching exact verification of approximate draft proposals",
        ],
        references: [
            "Leviathan, Kalman and Matias, Fast Inference from Transformers via Speculative Decoding, 2023",
            "Chen et al., Accelerating Large Language Model Decoding with Speculative Sampling, 2023",
        ],
        workedExample:
            "From token 0 suppose the target chain is 0 to 3 to 5 to 6 to 8 and the draft proposes 3, 5, 2, 7. The first two tokens match and are accepted. The third proposal 2 differs from the target's 6, so 6 is emitted, 7 is discarded, and the output 3, 5, 6 equals greedy decoding.",
    },
    id: "speculative-decoding",
    name: "Speculative Decoding (Greedy Verification)",
    category: "ml-ai",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: {
        start: 0,
        draft: [3, 5, 2, 7],
        transitions: { "0": 3, "3": 5, "5": 6, "6": 8, "8": 1 },
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the starting token, the draft tokens, and the target transition table",
        "set the current token to the starting token",
        "for each draft token in order",
        "compute the target's greedy next token from the current token",
        "if the draft token equals it, accept and advance the current token",
        "otherwise emit the target token, discard the remaining draft, and stop",
        "done: report the emitted token sequence",
    ],
};

export default module;
