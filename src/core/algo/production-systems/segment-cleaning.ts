/**
 * segment-cleaning.ts - LFS Segment Cleaning (Cost-Benefit Policy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A log-structured filesystem writes updates into append-only segments. Once
 * a segment holds stale blocks it must be cleaned: the live blocks are copied
 * elsewhere and the whole segment is freed. The cost-benefit policy ranks
 * segments by reclaimed space per unit of copying, (total - live) / live, and
 * cleans the highest-ranked segments first. Fully dead segments have infinite
 * benefit because they cost nothing to copy.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(S log S) to rank S segments, O(k) to apply the top k choices
 *   Space: O(S) for the ranked list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per segment, labeled with its live and total blocks.
 *   - The scored segment is CYAN; chosen segments are GREEN when cleaned.
 *   - Fully dead segments are highlighted as free wins.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Segment {
    id: number;
    live: number;
    total: number;
}

/** Rank segments by reclaimed space per copied block, tie-broken by id. */
function rank(segments: Segment[]): Array<{ segment: Segment; free: number; score: number }> {
    return segments
        .map((segment) => {
            const total = Math.max(0, Math.floor(segment.total));
            const live = Math.max(0, Math.min(total, Math.floor(segment.live)));
            const free = total - live;
            const score = live === 0 ? Number.POSITIVE_INFINITY : free / live;
            return { segment: { ...segment, live, total }, free, score };
        })
        .sort((a, b) => b.score - a.score || a.segment.id - b.segment.id);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { segments?: Segment[]; maxSegments?: number } | null) ?? {};
    const segments: Segment[] = Array.isArray(task.segments)
        ? task.segments.map((s) => ({
              id: Math.floor(s.id ?? 0),
              live: Math.floor(s.live ?? 0),
              total: Math.floor(s.total ?? 0),
          }))
        : [
              { id: 0, live: 10, total: 100 },
              { id: 1, live: 90, total: 100 },
              { id: 2, live: 40, total: 100 },
              { id: 3, live: 80, total: 100 },
              { id: 4, live: 20, total: 100 },
              { id: 5, live: 50, total: 100 },
          ];
    const maxSegments = Math.max(0, Math.floor(task.maxSegments ?? 2));

    const ranked = rank(segments);
    const chosen = ranked.slice(0, maxSegments);
    const chosenIds = new Set(chosen.map((c) => c.segment.id));
    const reclaimed = chosen.reduce((sum, c) => sum + c.free, 0);
    const copied = chosen.reduce((sum, c) => sum + c.segment.live, 0);

    const cells = (activeId: number, phase: "init" | "score" | "clean" | "final"): VisualEntity[] =>
        ranked.map((entry, index) => {
            const live = entry.segment.live;
            const dead = live === 0;
            let state: EntityState = dead ? "highlight" : "idle";
            if (phase === "score" && entry.segment.id === activeId) state = "comparing";
            if (chosenIds.has(entry.segment.id) && (phase === "clean" || phase === "final")) state = "sorted";
            return {
                id: `cell-${index}`,
                type: "cell" as const,
                label: `${entry.free}/${entry.segment.total}`,
                value: entry.free,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: {
                    row: index,
                    col: 0,
                    segmentId: entry.segment.id,
                    live,
                    total: entry.segment.total,
                    score: Number.isFinite(entry.score) ? entry.score : -1,
                },
            };
        });

    const commonMeta = {
        rows: ranked.length,
        cols: 1,
        segmentCount: ranked.length,
        scores: ranked.map((e) => (Number.isFinite(e.score) ? e.score : -1)),
    };

    yield {
        stepNumber: 0,
        entities: cells(-1, "init"),
        edges: [],
        description: `Evaluating ${ranked.length} segments with a cleaning budget of ${maxSegments} segment(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...commonMeta, phase: "init" },
    };
    let step = 1;
    for (const entry of ranked) {
        yield {
            stepNumber: step,
            entities: cells(entry.segment.id, "score"),
            edges: [],
            description: `Segment ${entry.segment.id} has ${entry.segment.live} live of ${entry.segment.total} blocks, giving benefit ${Number.isFinite(entry.score) ? entry.score.toFixed(2) : "infinite"}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...commonMeta, phase: "score", segmentId: entry.segment.id, score: Number.isFinite(entry.score) ? entry.score : -1 },
        };
        step += 1;
    }
    for (const entry of chosen) {
        yield {
            stepNumber: step,
            entities: cells(entry.segment.id, "clean"),
            edges: [],
            description: `Cleaning segment ${entry.segment.id}: copy ${entry.segment.live} live block(s) and reclaim ${entry.free} block(s).`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { ...commonMeta, phase: "clean", segmentId: entry.segment.id, reclaimedSoFar: reclaimed },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: cells(-1, "final"),
        edges: [],
        description: `Cleaned ${chosen.length} segment(s): reclaimed ${reclaimed} block(s) by copying ${copied} live block(s).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            ...commonMeta,
            phase: "final",
            chosen: chosen.map((c) => c.segment.id),
            reclaimed,
            copied,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Cleaning a segment means copying its surviving data before the whole segment can be reused. A segment full of stale data is a bargain, while a nearly full segment costs almost as much to copy as it returns. The cost-benefit policy divides reclaimed blocks by copied blocks and always cleans the best bargain first, with dead segments treated as free wins.",
        invariants: [
            "A segment's live plus free blocks always equal its total size.",
            "The ranking is nonincreasing in benefit, with segment id breaking ties.",
            "Every chosen segment contributes its live blocks to copying and its free blocks to reclaimed space.",
        ],
        correctness:
            "The score (total minus live) over live is exactly the reclaimed blocks per copied block, so a larger score strictly means more space freed per unit of copying. Sorting by that score and a fixed id tie-break yields the deterministic greedy order. Summing live and free over the chosen prefix therefore reports the precise copy cost and reclaimed space of the policy's decision.",
        complexityRationale:
            "Computing a score for each segment is linear, sorting is O(S log S), and summing a prefix of at most k segments is linear in k. Only the ranked list of S segments is stored.",
        uses: [
            "Log-structured and flash-filesystem garbage collection",
            "Choosing compaction victims in log-structured merge stores",
            "Reclaiming space in append-only object stores",
        ],
        references: [
            "Rosenblum and Ousterhout, The Log-Structured File System, 1992",
            "Matthews et al., Improving the Performance of Log-Structured File Systems, 1997",
        ],
        workedExample:
            "Segments with live counts 10, 90, 40, 80, 20 and 50 out of 100 have scores 9, 0.11, 1.5, 0.25, 4 and 1. With a budget of two, the cleaner picks segment 0 (90 reclaimed, 10 copied) then segment 4 (80 reclaimed, 20 copied), for 170 reclaimed and 30 copied.",
    },
    id: "segment-cleaning",
    name: "LFS Segment Cleaning (Cost-Benefit)",
    category: "production-systems",
    complexity: { time: "O(S log S)", space: "O(S)" },
    defaultInput: {
        segments: [
            { id: 0, live: 10, total: 100 },
            { id: 1, live: 90, total: 100 },
            { id: 2, live: 40, total: 100 },
            { id: 3, live: 80, total: 100 },
            { id: 4, live: 20, total: 100 },
            { id: 5, live: 50, total: 100 },
        ],
        maxSegments: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each segment compute free blocks as total minus live",
        "set its benefit to free divided by live, or infinite when live is zero",
        "sort segments by decreasing benefit, then by segment id",
        "select the first k segments as cleaning victims",
        "for each chosen segment copy its live blocks elsewhere",
        "free the entire chosen segment",
        "add its free blocks to the reclaimed total",
        "done: report chosen segments, reclaimed and copied blocks",
    ],
};

export default module;
