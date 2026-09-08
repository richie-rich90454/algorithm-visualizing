/**
 * girvan-newman-edge-betweenness.ts – Girvan–Newman Communities
 *
 * Repeatedly removes the edge with the highest betweenness: bridges between
 * groups carry all cross-traffic. First cut C–D splits the barbell in two.
 * Time: O(E²·V) Space: O(V + E)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; cuts?: number } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C"],
        C: ["A", "B", "D"],
        D: ["C", "E", "F"],
        E: ["D", "F"],
        F: ["D", "E"],
    };

    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(adjacency);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    const setE = (a: string, b: string, s: EntityState): void => {
        const e = edges.find((x) => x.sourceId === `node-${a}` && x.targetId === `node-${b}`);
        if (e) e.state = s;
    };
    const clr = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph" as const,
        meta,
    });
    if (labels.length === 0) {
        yield snap("Empty graph – nothing to explore.", 0);
        return;
    }
    const cuts = task.cuts ?? 1;
    const edgeKey = (a: string, b: string): string => [a, b].sort().join("|");
    const live = new Set<string>();
    for (const [u, vs] of Object.entries(adjacency)) for (const v of vs) live.add(edgeKey(u, v));
    yield snap(`Girvan–Newman: score every edge by betweenness, cut the top one.`, 0, {
        liveEdges: live.size,
    });
    step += 1;
    const nbr = (v: string): string[] =>
        (adjacency[v] ?? []).filter((w) => live.has(edgeKey(v, w)));
    for (let c = 0; c < cuts; c += 1) {
        const eb = new Map<string, number>();
        for (const s of labels) {
            const stack: string[] = [];
            const pred = new Map(labels.map((v) => [v, [] as string[]]));
            const sigma = new Map(labels.map((v) => [v, 0]));
            const dist = new Map(labels.map((v) => [v, -1]));
            sigma.set(s, 1);
            dist.set(s, 0);
            const queue = [s];
            while (queue.length > 0) {
                const v = queue.shift() as string;
                stack.push(v);
                for (const w of nbr(v)) {
                    if ((dist.get(w) as number) < 0) {
                        queue.push(w);
                        dist.set(w, (dist.get(v) as number) + 1);
                    }
                    if ((dist.get(w) as number) === (dist.get(v) as number) + 1) {
                        sigma.set(w, (sigma.get(w) as number) + (sigma.get(v) as number));
                        (pred.get(w) as string[]).push(v);
                    }
                }
            }
            const dep = new Map(labels.map((v) => [v, 0]));
            while (stack.length > 0) {
                const w = stack.pop() as string;
                for (const v of pred.get(w) as string[]) {
                    const share =
                        ((sigma.get(v) as number) / (sigma.get(w) as number)) *
                        (1 + (dep.get(w) as number));
                    eb.set(edgeKey(v, w), (eb.get(edgeKey(v, w)) ?? 0) + share / 2);
                    dep.set(v, (dep.get(v) as number) + share);
                }
            }
        }
        let top = "";
        let topV = -1;
        for (const [k, v] of eb)
            if (v > topV) {
                topV = v;
                top = k;
            }
        live.delete(top);
        const [a, b] = top.split("|") as [string, string];
        clr();
        setE(a, b, "swapped");
        setE(b, a, "swapped");
        yield snap(
            `Cut ${a}–${b} with betweenness ${topV.toFixed(1)} – the bridge carries all cross-traffic.`,
            1,
            {},
        );
        step += 1;
    }
    const comp = new Map<string, number>();
    let nc = 0;
    for (const s of labels) {
        if (comp.has(s)) continue;
        const stack = [s];
        comp.set(s, nc);
        while (stack.length > 0) {
            const u = stack.pop() as string;
            for (const w of nbr(u))
                if (!comp.has(w)) {
                    comp.set(w, nc);
                    stack.push(w);
                }
        }
        nc += 1;
    }
    clr();
    const palette: EntityState[] = ["sorted", "visited", "highlight"];
    for (const [v, i] of comp) setN(v, palette[(i as number) % palette.length] as EntityState);
    const parts: string[][] = Array.from({ length: nc }, () => []);
    for (const [v, i] of comp) (parts[i as number] as string[]).push(v);
    yield snap(
        `After ${cuts} cut(s): ${parts.map((p) => `{${p.sort().join(",")}}`).join(" ")}.`,
        2,
        { communities: nc },
    );
}

const module: AlgorithmModule = {
    id: "girvan-newman-edge-betweenness",
    name: "Girvan–Newman (Edge Betweenness)",
    category: "graph",
    complexity: { time: "O(E²·V)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C"],
            C: ["A", "B", "D"],
            D: ["C", "E", "F"],
            E: ["D", "F"],
            F: ["D", "E"],
        },
        cuts: 1,
    },
    visualType: "graph",
    run,
};

export default module;
