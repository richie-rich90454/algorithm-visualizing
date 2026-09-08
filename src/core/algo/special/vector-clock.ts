/**
 * vector-clock.ts – Vector Clocks.
 * Three processes carry [t0,t1,t2]: tick your own slot locally, take
 * the element-wise max plus your tick on receive. Comparing vectors
 * then reveals happened-before vs concurrent events.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    void input;
    const V = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];
    const inbox = new Map<number, number[]>();
    let step = 0;
    const frame = (active: number, desc: string, note: string): VisualFrame => {
        const entities: VisualEntity[] = [];
        V.forEach((vec, r) =>
            vec.forEach((v, c) => {
                entities.push({
                    id: `vc-${r}-${c}`,
                    type: "cell" as const,
                    label: String(v),
                    value: v,
                    state: (r === active
                        ? r === c
                            ? "comparing"
                            : "highlight"
                        : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col: c },
                });
            }),
        );
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: `${desc} ${note}`,
            codeLineNumber: step,
            layout: "grid",
            meta: { vectors: V.map((v) => v.join(".")) },
        };
    };
    const tick = (p: number): void => {
        V[p][p] = (V[p]?.[p] ?? 0) + 1;
    };
    const send = (p: number, to: number): void => {
        tick(p);
        inbox.set(to, [...(V[p] ?? [0, 0, 0])]);
    };
    const recv = (p: number): void => {
        const m = inbox.get(p) ?? [0, 0, 0];
        for (let i = 0; i < 3; i += 1) V[p][i] = Math.max(V[p]?.[i] ?? 0, m[i] ?? 0);
        tick(p);
    };
    yield frame(-1, "All vectors [0,0,0].", "");
    step += 1;
    tick(0);
    yield frame(0, "P0 works: [1,0,0].", "");
    step += 1;
    send(0, 1);
    yield frame(0, "P0 sends [2,0,0] to P1.", "");
    step += 1;
    recv(1);
    yield frame(1, "P1 receives: max([0,0,0],[2,0,0]) + tick = [2,1,0].", "");
    step += 1;
    tick(2);
    yield frame(2, "P2 works alone: [0,0,1].", "");
    step += 1;
    const a = V[1] as number[];
    const b = V[2] as number[];
    const le = a.every((v, i) => v <= (b[i] ?? 0)) && a.some((v, i) => v < (b[i] ?? 0));
    const ge = b.every((v, i) => v <= (a[i] ?? 0)) && b.some((v, i) => v < (a[i] ?? 0));
    const rel = le ? "P1 → P2 (happened-before)" : ge ? "P2 → P1" : "P1 ∥ P2 (concurrent)";
    yield frame(-1, `Compare [${a}] vs [${b}]: ${rel}.`, "Vector order = causal order.");
}

const module: AlgorithmModule = {
    id: "vector-clock",
    name: "Vector Clock",
    category: "data-structures",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { processes: 3 },
    visualType: "grid",
    run,
};

export default module;
