/**
 * c4-5.ts - C4.5 Decision Tree (Gain Ratio)
 *
 * C4.5 builds a decision tree by choosing the split with the highest gain
 * ratio, which divides the information gain by the split information. This
 * penalizes attributes with many values and avoids the bias that information
 * gain alone has toward high-branching attributes. The demo trains a small
 * categorical tree and visualizes the split scores.
 *
 * Time:  O(depth * attributes * rows) for the demo depth
 * Space: O(rows) for the recursion and drawn entities
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Row = Record<string, string>;

interface TreeInput {
    rows?: Row[];
    attributes?: string[];
    target?: string;
    maxDepth?: number;
}

const log2 = (x: number): number => (x <= 0 ? 0 : Math.log(x) / Math.LN2);

function entropy(rows: Row[], target: string): number {
    if (rows.length === 0) return 0;
    const counts = new Map<string, number>();
    for (const row of rows) {
        const key = row[target] ?? "";
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let result = 0;
    for (const count of counts.values()) {
        const p = count / rows.length;
        result -= p * log2(p);
    }
    return result;
}

function groupsBy(rows: Row[], attr: string): Map<string, Row[]> {
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
        const key = row[attr] ?? "";
        const group = groups.get(key);
        if (group) group.push(row);
        else groups.set(key, [row]);
    }
    return groups;
}

function informationGain(rows: Row[], attr: string, target: string): number {
    const base = entropy(rows, target);
    let rest = 0;
    for (const group of groupsBy(rows, attr).values()) {
        rest += (group.length / rows.length) * entropy(group, target);
    }
    return base - rest;
}

function splitInformation(rows: Row[], attr: string): number {
    let result = 0;
    for (const group of groupsBy(rows, attr).values()) {
        const p = group.length / rows.length;
        result -= p * log2(p);
    }
    return result;
}

function gainRatio(rows: Row[], attr: string, target: string): number {
    const split = splitInformation(rows, attr);
    return split > 1e-12 ? informationGain(rows, attr, target) / split : 0;
}

type TreeNode = { leaf: string } | { attr: string; branches: Map<string, TreeNode> };

function majority(rows: Row[], target: string): string {
    const counts = new Map<string, number>();
    for (const row of rows) {
        const key = row[target] ?? "";
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best = "";
    let bestCount = -1;
    for (const [key, count] of counts) {
        if (count > bestCount) {
            best = key;
            bestCount = count;
        }
    }
    return best;
}

function buildTree(rows: Row[], attrs: string[], target: string, depth: number, maxDepth: number): TreeNode {
    if (rows.length === 0) return { leaf: "" };
    if (entropy(rows, target) < 1e-12 || attrs.length === 0 || depth >= maxDepth) {
        return { leaf: majority(rows, target) };
    }
    let bestAttr = attrs[0] ?? "";
    let bestScore = -Infinity;
    for (const attr of attrs) {
        const score = gainRatio(rows, attr, target);
        if (score > bestScore) {
            bestScore = score;
            bestAttr = attr;
        }
    }
    const remaining = attrs.filter((attr) => attr !== bestAttr);
    const branches = new Map<string, TreeNode>();
    for (const [value, group] of groupsBy(rows, bestAttr)) {
        branches.set(value, buildTree(group, remaining, target, depth + 1, maxDepth));
    }
    return { attr: bestAttr, branches };
}

function predict(tree: TreeNode, row: Row): string {
    let node = tree;
    while ("attr" in node) {
        const next = node.branches.get(row[node.attr] ?? "");
        if (!next) return "";
        node = next;
    }
    return node.leaf;
}

function countLeaves(tree: TreeNode): number {
    if ("leaf" in tree) return 1;
    let total = 0;
    for (const child of tree.branches.values()) total += countLeaves(child);
    return total;
}

function makeBars(attrs: string[], gains: number[], splits: number[], ratios: number[], revealed: number, chosen: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const kinds = ["gain", "split", "ratio"];
    const all = [gains, splits, ratios];
    for (let a = 0; a < attrs.length; a += 1) {
        for (let k = 0; k < 3; k += 1) {
            const shown = a <= revealed;
            const value = all[k]?.[a] ?? 0;
            const state: EntityState = !shown
                ? "idle"
                : k === 2 && a === chosen
                  ? "sorted"
                  : k === 2
                    ? "active"
                    : "highlight";
            entities.push({
                id: `bar-${a}-${k}`,
                type: "bar" as const,
                label: shown ? `${attrs[a]} ${kinds[k]}: ${value.toFixed(3)}` : `${attrs[a]} ?`,
                value: shown ? value : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { attrIndex: a, kind: kinds[k], shown },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TreeInput | null) ?? {};
    const rows: Row[] = task.rows?.length
        ? task.rows
        : [
              { Outlook: "sunny", Windy: "false", Play: "yes" },
              { Outlook: "sunny", Windy: "true", Play: "no" },
              { Outlook: "overcast", Windy: "false", Play: "yes" },
              { Outlook: "overcast", Windy: "true", Play: "yes" },
              { Outlook: "rain", Windy: "false", Play: "yes" },
              { Outlook: "rain", Windy: "true", Play: "no" },
          ];
    const attributes = task.attributes?.length ? task.attributes : ["Outlook", "Windy"];
    const target = task.target ?? "Play";
    const maxDepth = typeof task.maxDepth === "number" ? Math.max(1, Math.floor(task.maxDepth)) : 3;

    const gains = attributes.map((attr) => informationGain(rows, attr, target));
    const splits = attributes.map((attr) => splitInformation(rows, attr));
    const ratios = attributes.map((attr, i) => (splits[i] ?? 0) > 1e-12 ? (gains[i] ?? 0) / (splits[i] ?? 0) : 0);
    let chosen = 0;
    for (let i = 1; i < ratios.length; i += 1) {
        if ((ratios[i] ?? 0) > (ratios[chosen] ?? 0)) chosen = i;
    }
    const tree = buildTree(rows, attributes, target, 0, maxDepth);
    const correct = rows.filter((row) => predict(tree, row) === (row[target] ?? "")).length;
    const accuracy = correct / Math.max(1, rows.length);
    const base = { attributes: attributes.slice(), gains: gains.slice(), splits: splits.slice(), ratios: ratios.slice(), chosen, accuracy, rowCount: rows.length };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(attributes, gains, splits, ratios, -1, -1),
        edges: [],
        description: `Evaluate ${attributes.length} candidate splits on ${rows.length} rows using gain ratio.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, phase: 0 },
    };
    step += 1;

    for (let a = 0; a < attributes.length; a += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(attributes, gains, splits, ratios, a, -1),
            edges: [],
            description: `Attribute ${attributes[a]}: information gain ${(gains[a] ?? 0).toFixed(4)}, split information ${(splits[a] ?? 0).toFixed(4)}, gain ratio ${(ratios[a] ?? 0).toFixed(4)}.`,
            codeLineNumber: a === attributes.length - 1 ? 4 : 2,
            layout: "array",
            meta: { ...base, phase: a + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(attributes, gains, splits, ratios, attributes.length - 1, chosen),
        edges: [],
        description: `Split on ${attributes[chosen]} with the highest gain ratio ${(ratios[chosen] ?? 0).toFixed(4)}; training accuracy ${(accuracy * 100).toFixed(1)} percent.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...base, phase: attributes.length + 1, chosenAttribute: attributes[chosen], leafCount: countLeaves(tree) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(attributes, gains, splits, ratios, attributes.length - 1, chosen),
        edges: [],
        description: `Done: tree has ${countLeaves(tree)} leaves and classifies ${correct} of ${rows.length} training rows correctly.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...base, phase: attributes.length + 2, correct, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Information gain tends to favor attributes with many values, even when they are not useful. C4.5 divides the gain by the attribute's own split information, measuring how much of the gain is just a consequence of creating many small branches. The resulting gain ratio compares attributes more fairly and drives the famous C4.5 tree learner.",
        invariants: [
            "Entropy is zero for a set of rows that all share the target value.",
            "Information gain is the parent entropy minus the weighted child entropies.",
            "Gain ratio is information gain divided by split information when the latter is positive.",
        ],
        correctness:
            "Split information is the entropy of the distribution of rows across an attribute's values, so dividing by it removes the mechanical advantage of high branching. Choosing the maximum gain ratio therefore favors attributes that genuinely reduce target entropy. The test recomputes entropy, gain, split information and gain ratio independently, confirms the chosen attribute is the argmax, and checks that the resulting tree classifies the consistent training data perfectly.",
        complexityRationale:
            "At each of the depth levels the learner scores every attribute by scanning the rows, so time is O(depth times attributes times rows). The recursion and the drawn bars use space linear in the rows and attributes.",
        uses: [
            "Interpretable classification with categorical features",
            "A baseline before moving to ensemble methods",
            "Rule extraction from small tabular datasets",
        ],
        references: [
            "Quinlan, C4.5: Programs for Machine Learning, 1993",
            "Mitchell, Machine Learning, Chapter 3, 1997",
        ],
        workedExample:
            "On six rows with attributes Outlook and Windy, both attributes may have useful gains, but Outlook creates three branches while Windy creates two. Dividing each gain by its split information adjusts for that difference. The tree splits on the higher-ratio attribute first, then uses the other on the mixed branch, and classifies all six rows correctly.",
    },
    id: "c4-5",
    name: "C4.5 Decision Tree",
    category: "ml-ai",
    complexity: { time: "O(depth * attributes * rows)", space: "O(rows)" },
    defaultInput: {
        rows: [
            { Outlook: "sunny", Windy: "false", Play: "yes" },
            { Outlook: "sunny", Windy: "true", Play: "no" },
            { Outlook: "overcast", Windy: "false", Play: "yes" },
            { Outlook: "overcast", Windy: "true", Play: "yes" },
            { Outlook: "rain", Windy: "false", Play: "yes" },
            { Outlook: "rain", Windy: "true", Play: "no" },
        ],
        attributes: ["Outlook", "Windy"],
        target: "Play",
        maxDepth: 3,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the training rows and candidate attributes",
        "for each attribute compute the information gain",
        "compute the split information of that attribute",
        "divide gain by split information to get the gain ratio",
        "choose the attribute with the largest gain ratio",
        "split there and recurse until a branch is pure",
        "done: report the tree and its training accuracy",
    ],
};

export default module;
