/**
 * rejection-sampling-finetuning.ts - Rejection Sampling Fine-Tuning (RFT)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RFT is a simple reinforcement-learning-from-feedback method: sample several
 * candidate completions for a prompt, keep only those a reward model scores
 * above a threshold, remove duplicates, and fine-tune on the surviving
 * completions with supervised cross-entropy. Repeating this process turns the
 * model's own successes into training data without a learned critic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(C log C + V) for C candidates and vocabulary size V per step
 *   Space: O(C + V) for the filtered set and the logit vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Each candidate is a row showing its reward and selection state.
 *   - Kept candidates are green, rejected red, duplicates idle.
 *   - Frame meta exposes rewards, selected ids, and the SFT logit update.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Candidate {
    id: number;
    tokens: number[];
    reward: number;
}

interface RftInput {
    candidates?: Candidate[];
    threshold?: number;
    maxKeep?: number;
    logits?: number[];
    targets?: number[];
    learningRate?: number;
}

/** Filter by reward, rank, deduplicate by token sequence, and cap the count. */
export function selectRftSamples(
    candidates: Candidate[],
    threshold: number,
    maxKeep: number,
): { selected: Candidate[]; reasons: Record<number, string> } {
    const ranked = candidates
        .map((c, index) => ({ c, index }))
        .filter((entry) => entry.c.reward >= threshold)
        .sort((a, b) => b.c.reward - a.c.reward || a.index - b.index);
    const seen = new Set<string>();
    const selected: Candidate[] = [];
    const reasons: Record<number, string> = {};
    for (const entry of ranked) {
        if (selected.length >= maxKeep) {
            reasons[entry.c.id] = "cap";
            continue;
        }
        const key = entry.c.tokens.join(",");
        if (seen.has(key)) {
            reasons[entry.c.id] = "duplicate";
            continue;
        }
        seen.add(key);
        selected.push(entry.c);
        reasons[entry.c.id] = "kept";
    }
    candidates.forEach((c, index) => {
        if (c.reward < threshold) reasons[c.id] = "reward";
        if (reasons[c.id] === undefined) reasons[c.id] = "cap";
    });
    return { selected, reasons };
}

/** One supervised cross-entropy gradient step on a softmax classifier. */
export function sftStep(logits: number[], targets: number[], learningRate: number): { next: number[]; loss: number } {
    const max = Math.max(...logits);
    const exps = logits.map((v) => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((e) => e / sum);
    const distribution = new Array<number>(logits.length).fill(0);
    for (const target of targets) {
        if (target >= 0 && target < distribution.length) {
            distribution[target] += 1 / Math.max(1, targets.length);
        }
    }
    const next = probs.map((p, i) => p + learningRate * ((distribution[i] ?? 0) - p));
    let loss = 0;
    for (const target of targets) {
        loss += -Math.log(Math.max(1e-12, probs[target] ?? 1e-12));
    }
    return { next, loss: loss / Math.max(1, targets.length) };
}

/** Plain records for frame meta. */
function metaCandidates(list: Candidate[]): Array<Record<string, number | number[]>> {
    return list.map((candidate) => ({ id: candidate.id, tokens: [...candidate.tokens], reward: candidate.reward }));
}

function makeCells(candidates: Candidate[], reasons: Record<number, string>, active: number): VisualEntity[] {
    return candidates.map((c, col) => {
        const reason = reasons[c.id] ?? "pending";
        const state: EntityState = reason === "kept" ? "sorted" : reason === "pending" ? "idle" : "error";
        return {
            id: `candidate-${col}`,
            type: "cell" as const,
            label: c.reward.toFixed(2),
            value: c.reward,
            state: col === active ? "comparing" : state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col, id: c.id, reason, tokens: c.tokens.join(",") },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RftInput | null) ?? {};
    const candidates: Candidate[] = (task.candidates ?? [
        { id: 0, tokens: [2, 5, 1], reward: 0.92 },
        { id: 1, tokens: [3, 1, 4], reward: 0.61 },
        { id: 2, tokens: [2, 5, 1], reward: 0.88 },
        { id: 3, tokens: [7, 2, 0], reward: 0.79 },
        { id: 4, tokens: [1, 4, 6], reward: 0.74 },
        { id: 5, tokens: [0, 3, 2], reward: 0.45 },
    ]).map((c) => ({ id: c.id, tokens: [...c.tokens], reward: c.reward }));
    const threshold = typeof task.threshold === "number" ? task.threshold : 0.7;
    const maxKeep = Math.max(1, Math.floor(task.maxKeep ?? 3));
    const logits = (task.logits ?? [1, 0, 0, 0]).map(Number);
    const targets = (task.targets ?? [2, 0, 1, 3]).map(Number);
    const learningRate = typeof task.learningRate === "number" ? task.learningRate : 0.5;
    const { selected, reasons } = selectRftSamples(candidates, threshold, maxKeep);
    const targetIds = selected.map((c) => c.id);
    const sft = sftStep(logits, targets, learningRate);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(candidates, {}, -1),
        edges: [],
        description: `Sampled ${candidates.length} completions; keep those with reward at least ${threshold}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: candidates.length, candidates: metaCandidates(candidates), threshold, maxKeep, reasons: [], logits, nextLogits: logits, loss: 0 },
    };
    step += 1;

    for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i]!;
        const reason = reasons[candidate.id] ?? "pending";
        yield {
            stepNumber: step,
            entities: makeCells(candidates, candidates.slice(0, i + 1).reduce<Record<number, string>>((acc, c) => {
                acc[c.id] = reasons[c.id] ?? "pending";
                return acc;
            }, {}), i),
            edges: [],
            description: `Candidate ${candidate.id} reward ${candidate.reward.toFixed(2)}: ${reason}.`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "grid",
            meta: { rows: 1, cols: candidates.length, candidates: metaCandidates(candidates), threshold, maxKeep, selected: targetIds, reason },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(candidates, reasons, -1),
        edges: [],
        description: `Kept ${selected.length} completions; SFT loss ${sft.loss.toFixed(4)}, logits moved toward the targets.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 1,
            cols: candidates.length,
            candidates: metaCandidates(candidates),
            threshold,
            maxKeep,
            selected: targetIds,
            reasons: Object.entries(reasons).map(([key, value]) => [Number(key), value]),
            logits,
            nextLogits: sft.next,
            loss: sft.loss,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A model's own correct answers are useful training data. RFT samples many completions, scores them with a reward model, throws away the weak and duplicated ones, and then trains on the rest with ordinary supervised cross-entropy. It is a lightweight alternative to policy-gradient methods because it needs no value function.",
        invariants: [
            "A completion is eligible only when its reward meets or exceeds the threshold.",
            "Duplicate token sequences are counted once.",
            "At most the configured number of completions survive into the SFT step.",
        ],
        correctness:
            "Filtering by threshold and sorting by reward with index tie-breaking is a brute-force selection of the highest-reward eligible completions. Deduplication by the exact token sequence keeps one representative of each answer. The SFT step moves each logit toward the empirical target distribution by the learning-rate scaled cross-entropy gradient, which is the exact gradient of softmax cross-entropy with respect to the logits.",
        complexityRationale:
            "Ranking C candidates costs O(C log C), deduplication uses a set of token keys, and the softmax gradient step costs O(V) for a vocabulary of V entries, so total space is O(C + V).",
        uses: [
            "Aligning language models from scored model-generated data",
            "Bootstrapping reasoning from self-generated correct solutions",
            "Cheap fine-tuning when a reward model is available but no critic is trained",
        ],
        references: [
            "Yuan et al., Scaling Relationship on Learning Mathematical Reasoning with Large Language Models, 2023",
            "Zelikman et al., STaR: Self-Taught Reasoner, ICLR 2022",
        ],
        workedExample:
            "With threshold 0.7 and candidates rewarded 0.92, 0.61, 0.88 and 0.74, the 0.61 completion is dropped. If two survivors share the same token sequence, only the higher-reward one is kept, leaving three completions for the supervised update.",
    },
    id: "rejection-sampling-finetuning",
    name: "Rejection Sampling Fine-Tuning",
    category: "ml-ai",
    complexity: { time: "O(C log C + V)", space: "O(C + V)" },
    defaultInput: {
        candidates: [
            { id: 0, tokens: [2, 5, 1], reward: 0.92 },
            { id: 1, tokens: [3, 1, 4], reward: 0.61 },
            { id: 2, tokens: [2, 5, 1], reward: 0.88 },
            { id: 3, tokens: [7, 2, 0], reward: 0.79 },
            { id: 4, tokens: [1, 4, 6], reward: 0.74 },
            { id: 5, tokens: [0, 3, 2], reward: 0.45 },
        ],
        threshold: 0.7,
        maxKeep: 3,
        logits: [1, 0, 0, 0],
        targets: [2, 0, 1, 3],
        learningRate: 0.5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "sample a batch of candidate completions with reward scores",
        "discard every completion below the reward threshold",
        "rank the survivors by descending reward with index tie-break",
        "remove completions whose token sequence was already kept",
        "stop after the configured maximum number of completions",
        "build the empirical target distribution from the survivors",
        "take one cross-entropy gradient step on the model logits",
        "done: return the filtered set and updated logits",
    ],
};

export default module;
