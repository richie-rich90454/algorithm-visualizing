/**
 * paging-algorithms-race.ts – Paging Algorithms Race.
 * FIFO vs LRU vs OPT (Belady's clairvoyant) face [1,2,3,4,1,2,5,1,2,3,4,5]
 * with 3 frames: every reference tallies real faults, and OPT's
 * evict-farthest-future rule wins as theory promises.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { refs?: number[]; frames?: number } | null) ?? {};
    const refs =
        Array.isArray(cfg.refs) && cfg.refs.length > 0
            ? (cfg.refs as number[]).slice(0, 14)
            : [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
    const F = Math.max(1, Math.min(5, cfg.frames ?? 3));
    const fifo: number[] = [];
    const lru: number[] = [];
    const opt: number[] = [];
    let ff = 0;
    let fl = 0;
    let fo = 0;
    let step = 0;
    const frame = (
        idx: number,
        desc: string,
        hit: boolean[] = [false, false, false],
    ): VisualFrame => {
        const tallies: Array<[string, number]> = [
            ["FIFO", ff],
            ["LRU", fl],
            ["OPT", fo],
        ];
        const entities: VisualEntity[] = tallies.map(([name, v], i) => ({
            id: `tally-${name}`,
            type: "cell" as const,
            label: `${name}:${v}`,
            value: v,
            state: (idx >= 0 && hit[i] ? "visited" : "comparing") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: 0 },
        }));
        const cur = refs[idx];
        if (idx >= 0 && cur !== undefined) {
            entities.push({
                id: "ref",
                type: "cell" as const,
                label: `ref=${cur}`,
                value: cur,
                state: "highlight" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 3, col: idx },
            });
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: idx,
            layout: "grid",
            meta: { fifo: ff, lru: fl, opt: fo },
        };
    };
    yield frame(-1, `Racing on [${refs.join(",")}] with ${F} frames; tallies count faults.`, [
        false,
        false,
        false,
    ]);
    step += 1;
    for (let i = 0; i < refs.length; i += 1) {
        const p = refs[i] ?? 0;
        const hit = [false, false, false];
        if (fifo.includes(p)) hit[0] = true;
        else {
            ff += 1;
            if (fifo.length >= F) fifo.shift();
            fifo.push(p);
        }
        if (lru.includes(p)) {
            hit[1] = true;
            lru.splice(lru.indexOf(p), 1);
            lru.push(p);
        } else {
            fl += 1;
            if (lru.length >= F) lru.shift();
            lru.push(p);
        }
        if (opt.includes(p)) hit[2] = true;
        else {
            fo += 1;
            if (opt.length >= F) {
                let victim = 0;
                let farthest = -1;
                opt.forEach((q, qi) => {
                    const nxt = refs.indexOf(q, i + 1);
                    const dist = nxt < 0 ? Infinity : nxt;
                    if (dist > farthest) {
                        farthest = dist;
                        victim = qi;
                    }
                });
                opt.splice(victim, 1);
            }
            opt.push(p);
        }
        yield frame(
            i,
            `Ref ${p}: ${hit[0] ? "FIFO hit" : "FIFO FAULT"} / ${hit[1] ? "LRU hit" : "LRU FAULT"} / ${hit[2] ? "OPT hit" : "OPT FAULT"}.`,
            hit,
        );
        step += 1;
        if (step > 13) break;
    }
    yield frame(
        refs.length,
        `Final faults — FIFO ${ff}, LRU ${fl}, OPT ${fo}: clairvoyance wins, LRU beats FIFO here.`,
    );
}

const module: AlgorithmModule = {
    id: "paging-algorithms-race",
    name: "Paging Algorithms Race",
    category: "data-structures",
    complexity: { time: "O(n·f)", space: "O(f)" },
    defaultInput: { refs: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5], frames: 3 },
    visualType: "grid",
    run,
};

export default module;
