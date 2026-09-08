/**
 * decision-tree-id3.ts – ID3 decision tree (entropy + information gain).
 * Splits on the max-gain attribute; pure branches become leaves.
 * Default tennis data splits first on Humidity (gain 0.595).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Row = Record<string, string>;
type Edge = {
    id: string;
    sourceId: string;
    targetId: string;
    label: string;
    state: EntityState;
    directed: boolean;
};

const log2 = (x: number): number => (x <= 0 ? 0 : Math.log(x) / Math.LN2);
const entropy = (rows: Row[], target: string): number => {
    if (rows.length === 0) return 0;
    const counts = new Map<string, number>();
    for (const r of rows)
        counts.set(r[target] as string, (counts.get(r[target] as string) ?? 0) + 1);
    let h = 0;
    for (const c of counts.values()) {
        const p = c / rows.length;
        h -= p * log2(p);
    }
    return h;
};
const gain = (rows: Row[], attr: string, target: string): number => {
    const h0 = entropy(rows, target);
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
        const v = r[attr] as string;
        if (!groups.has(v)) groups.set(v, []);
        groups.get(v)?.push(r);
    }
    let rest = 0;
    for (const g of groups.values()) rest += (g.length / rows.length) * entropy(g, target);
    return h0 - rest;
};
const round3 = (x: number): number => Math.round(x * 1000) / 1000;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { rows?: unknown; target?: unknown } | null) ?? {};
    const rows: Row[] = Array.isArray(t.rows)
        ? (t.rows as Row[])
        : [
              { Outlook: "S", Humidity: "H", Play: "N" },
              { Outlook: "S", Humidity: "H", Play: "N" },
              { Outlook: "O", Humidity: "H", Play: "Y" },
              { Outlook: "R", Humidity: "N", Play: "Y" },
              { Outlook: "R", Humidity: "N", Play: "Y" },
              { Outlook: "O", Humidity: "N", Play: "Y" },
              { Outlook: "S", Humidity: "N", Play: "Y" },
              { Outlook: "R", Humidity: "H", Play: "N" },
          ];
    const target = typeof t.target === "string" ? t.target : "Play";

    // Tree nodes built during ID3: id → { label, parent }.
    const parents = new Map<string, string | null>();
    const labels = new Map<string, string>();
    parents.set("root", null);
    const emit = (
        step: number,
        states: Record<string, EntityState>,
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => {
        const order = [...parents.keys()];
        return {
            stepNumber: step,
            entities: order.map((id) => ({
                id: `node-${id}`,
                type: "node" as const,
                label: labels.get(id) ?? id,
                value: labels.get(id) ?? id,
                state: states[id] ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: {
                    parentId: parents.get(id) ? `node-${parents.get(id)}` : "root",
                },
            })),
            edges: order.flatMap((id) => {
                const p = parents.get(id);
                return p
                    ? [
                          {
                              id: `edge-node-${p}-node-${id}`,
                              sourceId: `node-${p}`,
                              targetId: `node-${id}`,
                              label: "",
                              state: "idle" as EntityState,
                              directed: false,
                          },
                      ]
                    : [];
            }),
            description,
            codeLineNumber,
            layout: "tree" as const,
            meta,
        };
    };

    let step = 0;
    if (rows.length === 0) {
        yield emit(step, {}, "No training rows – empty decision tree.", 0, {
            rootSplit: "none",
            depth: 0,
        });
        return;
    }
    const attrs = Object.keys(rows[0] as Row).filter((a) => a !== target);
    const h0 = entropy(rows, target);
    labels.set("root", "?");

    yield emit(step, {}, `ID3 on ${rows.length} rows – target ${target}.`, 0);
    step += 1;
    yield emit(step, { root: "comparing" }, `Root entropy is ${round3(h0)}.`, 1);
    step += 1;

    const gains = attrs.map((a) => ({ attr: a, g: gain(rows, a, target) }));
    for (const { attr, g } of gains) {
        yield emit(step, { root: "comparing" }, `Gain(${attr}) = ${round3(g)}.`, 2);
        step += 1;
    }
    gains.sort((a, b) => b.g - a.g);
    const split = gains[0]?.attr ?? attrs[0] ?? target;
    labels.set("root", split);
    yield emit(
        step,
        { root: "highlight" },
        `Splitting on ${split} (gain ${round3(gains[0]?.g ?? 0)}).`,
        3,
        {
            rootSplit: split,
        },
    );
    step += 1;

    // One level of children; impure branches split once more, else majority leaf.
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
        const v = String(r[split]);
        if (!groups.has(v)) groups.set(v, []);
        groups.get(v)?.push(r);
    }
    let depth = 1;
    for (const [val, g] of [...groups.entries()].slice(0, 4)) {
        const id = `v-${val}`;
        parents.set(id, "root");
        const h = entropy(g, target);
        if (h === 0) {
            labels.set(id, `${val}→${g[0]?.[target]}`);
            yield emit(
                step,
                { [id]: "sorted", root: "visited" },
                `Branch ${split}=${val} is pure (${g[0]?.[target]}) – leaf.`,
                4,
            );
        } else {
            const rest = attrs.filter((a) => a !== split);
            const g2 = rest
                .map((a) => ({ attr: a, g: gain(g, a, target) }))
                .sort((a, b) => b.g - a.g);
            const sub = g2[0]?.attr;
            if (!sub) {
                const maj = [...g.map((r) => r[target] as string)].sort()[0];
                labels.set(id, `${val}→${maj}`);
                yield emit(
                    step,
                    { [id]: "sorted", root: "visited" },
                    `Branch ${split}=${val} takes majority ${maj} – leaf.`,
                    4,
                );
            } else {
                depth = 2;
                labels.set(id, `${val}:${sub}`);
                parents.set(`${id}-leaf`, id);
                labels.set(`${id}-leaf`, "…");
                yield emit(
                    step,
                    { [id]: "comparing", root: "visited" },
                    `Branch ${split}=${val} (entropy ${round3(h)}) splits on ${sub}.`,
                    4,
                );
            }
        }
        step += 1;
        if (step > 11) break;
    }
    const states: Record<string, EntityState> = {};
    for (const id of parents.keys()) states[id] = "sorted";
    yield emit(step, states, `ID3 done – root split ${split}, depth ${depth}.`, 5, {
        rootSplit: split,
        depth,
    });
}

const module: AlgorithmModule = {
    id: "decision-tree-id3",
    name: "Decision Tree ID3",
    category: "tree",
    complexity: { time: "O(m·n·v)", space: "O(n)" },
    defaultInput: {
        rows: [
            { Outlook: "S", Humidity: "H", Play: "N" },
            { Outlook: "S", Humidity: "H", Play: "N" },
            { Outlook: "O", Humidity: "H", Play: "Y" },
            { Outlook: "R", Humidity: "N", Play: "Y" },
            { Outlook: "R", Humidity: "N", Play: "Y" },
            { Outlook: "O", Humidity: "N", Play: "Y" },
            { Outlook: "S", Humidity: "N", Play: "Y" },
            { Outlook: "R", Humidity: "H", Play: "N" },
        ],
        target: "Play",
    },
    visualType: "tree",
    run,
};

export default module;
