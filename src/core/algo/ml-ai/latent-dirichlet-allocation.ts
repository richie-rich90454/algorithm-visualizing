/**
 * latent-dirichlet-allocation.ts - Collapsed Gibbs Sampling for LDA
 *
 * Latent Dirichlet Allocation models each document as a mixture of topics and
 * each topic as a mixture of words. Collapsed Gibbs sampling integrates out the
 * mixture weights and repeatedly resamples each token's topic from its
 * conditional distribution given the other tokens.
 *
 * Time:  O(iterations * tokens * topics)
 * Space: O(topics * vocabulary + documents * topics)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LdaInput {
    documents: number[][];
    topics: number;
    alpha: number;
    beta: number;
    iterations: number;
    vocabSize: number;
    seed: number;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<LdaInput> | null) ?? {};
    const documents: number[][] = Array.isArray(task.documents) && task.documents.length > 0
        ? task.documents.map((doc) => doc.slice())
        : [[0, 0, 1, 2], [1, 1, 2, 2], [0, 1, 2, 0]];
    const topics = Math.max(1, Math.floor(task.topics ?? 2));
    const alpha = Math.max(1e-9, task.alpha ?? 0.5);
    const beta = Math.max(1e-9, task.beta ?? 0.5);
    const iterations = Math.max(1, Math.floor(task.iterations ?? 6));
    const vocabSize = Math.max(1, Math.floor(task.vocabSize ?? 3));
    let rngState = (Math.floor(task.seed ?? 11) >>> 0) || 1;
    const random = (): number => {
        rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
        return rngState / 4294967296;
    };

    const D = documents.length;
    const assignments = documents.map((doc) => doc.map(() => Math.floor(random() * topics)));
    const docTopic = Array.from({ length: D }, () => Array(topics).fill(0) as number[]);
    const topicWord = Array.from({ length: topics }, () => Array(vocabSize).fill(0) as number[]);
    const topicTotal = Array(topics).fill(0) as number[];
    for (let d = 0; d < D; d += 1) {
        documents[d]!.forEach((word, i) => {
            const topic = assignments[d]![i]!;
            docTopic[d]![topic]! += 1;
            topicWord[topic]![word % vocabSize]! += 1;
            topicTotal[topic]! += 1;
        });
    }

    const flattenCounts = (matrix: number[][]): number[] => matrix.reduce((acc: number[], row) => acc.concat(row), []);
    const allAssignments = (): number[] => assignments.reduce((acc: number[], row) => acc.concat(row), []);
    const cells = (): VisualEntity[] =>
        docTopic.flatMap((row, d) => row.map((count, k) => ({
            id: `cell-${d}-${k}`,
            type: "cell" as const,
            label: `d${d} t${k}: ${count}`,
            value: count,
            state: (count > 0 ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: d, col: k },
        })));
    const frameMeta = (iteration: number, logLikelihood: number) => ({
        D,
        topics,
        vocabSize,
        iterations,
        rows: D,
        cols: topics,
        iteration,
        logLikelihood,
        docTopicCounts: flattenCounts(docTopic),
        topicWordCounts: flattenCounts(topicWord),
        assignments: allAssignments(),
    });

    let logLikelihood = 0;
    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(),
        edges: [],
        description: `Initialize collapsed LDA with ${D} documents, ${topics} topics, and a ${vocabSize}-word vocabulary.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: frameMeta(0, 0),
    };
    step += 1;

    for (let iter = 1; iter <= iterations; iter += 1) {
        logLikelihood = 0;
        for (let d = 0; d < D; d += 1) {
            const doc = documents[d]!;
            for (let i = 0; i < doc.length; i += 1) {
                const word = doc[i]! % vocabSize;
                const old = assignments[d]![i]!;
                docTopic[d]![old]! -= 1;
                topicWord[old]![word]! -= 1;
                topicTotal[old]! -= 1;

                const probs = Array.from({ length: topics }, (_unused, k) =>
                    (docTopic[d]![k]! + alpha) * (topicWord[k]![word]! + beta) / (topicTotal[k]! + vocabSize * beta),
                );
                const total = probs.reduce((a, b) => a + b, 0);
                const draw = random() * total;
                let cumulative = 0;
                let chosen = topics - 1;
                for (let k = 0; k < topics; k += 1) {
                    cumulative += probs[k]!;
                    if (draw < cumulative) {
                        chosen = k;
                        break;
                    }
                }
                assignments[d]![i] = chosen;
                docTopic[d]![chosen]! += 1;
                topicWord[chosen]![word]! += 1;
                topicTotal[chosen]! += 1;
                logLikelihood += Math.log((probs[chosen] ?? 0) / total);
            }
        }
        yield {
            stepNumber: step,
            entities: cells(),
            edges: [],
            description: `Gibbs iteration ${iter}: resampled every token's topic from its collapsed conditional distribution.`,
            codeLineNumber: iter === iterations ? 6 : 5,
            layout: "grid",
            meta: frameMeta(iter, logLikelihood),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells(),
        edges: [],
        description: `Done: ${D} documents summarized by ${topics} topics with logged assignment likelihood ${logLikelihood.toFixed(3)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...frameMeta(iterations, logLikelihood), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "LDA assumes each document mixes a few themes and each theme favors certain words. Collapsed Gibbs sampling discovers the hidden theme of every word by repeatedly asking: given all the other assignments, which topic would most likely have produced this word in this document? Over many sweeps, stable document topic mixtures and topic word distributions emerge.",
        invariants: [
            "Every token carries exactly one topic assignment in the valid range.",
            "The document topic counts and topic word counts always agree with the current assignments.",
            "Each conditional distribution is positive because the Dirichlet hyperparameters smooth all counts.",
        ],
        correctness:
            "Collapsing out the Dirichlet mixture weights gives the conditional probability of a topic for one token proportional to the document topic count plus alpha times the topic word count plus beta over the topic total plus the vocabulary size times beta. Sampling from this normalized distribution leaves the joint distribution over assignments invariant, so the chain converges to the posterior. The test recomputes both count matrices directly from the reported assignments and confirms they match, which verifies the bookkeeping that drives every conditional.",
        complexityRationale:
            "Each token update evaluates the conditional for all topics, costing O(topics), and there are as many tokens as the documents contain, so one sweep is O(tokens * topics). The two count tables occupy O(documents * topics + topics * vocabulary) space.",
        uses: [
            "Discovering themes in large text corpora",
            "Document clustering and recommendation features",
            "Topic-level summaries for search and archival systems",
        ],
        references: [
            "Blei, Ng, and Jordan, Latent Dirichlet Allocation, JMLR, 2003",
            "Griffiths and Steyvers, Finding Scientific Topics, PNAS, 2004",
        ],
        workedExample:
            "With two documents about apples and two about finance, a two-topic model starts with random assignments. A token for the word apple in a fruit document receives a high conditional probability for the topic already rich in apple and fruit words, so the sampler tends to move it there. After several sweeps the count matrix shows one topic concentrated on food words and the other on market words.",
    },
    id: "latent-dirichlet-allocation",
    name: "Latent Dirichlet Allocation (Collapsed Gibbs)",
    category: "ml-ai",
    complexity: { time: "O(iterations * tokens * topics)", space: "O(topics * vocabSize + documents * topics)" },
    defaultInput: {
        documents: [[0, 0, 1, 2], [1, 1, 2, 2], [0, 1, 2, 0]],
        topics: 2,
        alpha: 0.5,
        beta: 0.5,
        iterations: 6,
        vocabSize: 3,
        seed: 11,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "randomly assign a topic to every token in every document",
        "tally document topic counts and topic word counts",
        "for each sweep visit every token and remove its current topic from the counts",
        "compute each topic's conditional weight from the smoothed count products",
        "normalize the weights and sample a new topic from that distribution",
        "add the token back to the chosen topic's counts",
        "repeat for the iteration budget",
        "done: report the document topic counts and assignment likelihood",
    ],
};

export default module;
