/**
 * blue-green-deployment.ts - Blue-Green Deployment Switchover
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Blue-green deployment keeps two identical environments. The live "blue"
 * environment keeps serving traffic while the new version is deployed and
 * tested on an idle "green" environment. Once smoke tests pass, the router is
 * switched atomically so green becomes live; blue stays untouched as an
 * immediate rollback target until a bake period confirms the release is sound.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for a fixed number of deployment phases
 *   Space: O(1) for the three nodes and one active edge
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes represent the router, the blue environment, and the green one.
 *   - A directed edge from the router marks the currently live environment.
 *   - Node states show idle, ready, active, and decommissioned phases.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface BlueGreenInput {
    greenReady?: boolean;
    smokeTests?: boolean[];
    bakeSucceeded?: boolean;
}

/** Build the router and two environment nodes for a phase. */
function makeNodes(active: "blue" | "green", greenState: EntityState, blueState: EntityState): VisualEntity[] {
    return [
        {
            id: "router",
            type: "node" as const,
            label: "router",
            value: "router",
            state: "active" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "router" },
        },
        {
            id: "blue",
            type: "node" as const,
            label: "blue",
            value: "blue",
            state: blueState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "environment" },
        },
        {
            id: "green",
            type: "node" as const,
            label: "green",
            value: "green",
            state: greenState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "environment" },
        },
    ];
}

/** One directed router edge to the live environment. */
function makeEdge(active: "blue" | "green"): VisualEdge[] {
    return [{
        id: `edge-router-${active}`,
        sourceId: "router",
        targetId: active,
        label: "live traffic",
        state: "active" as EntityState,
        directed: true,
    }];
}

/** Simulate a blue-green deployment switchover. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BlueGreenInput | null) ?? {};
    const greenReady = task.greenReady !== false;
    const smokeTests: boolean[] = task.smokeTests ?? [true, true, true];
    const bakeSucceeded = task.bakeSucceeded !== false;
    const smokePassed = greenReady && smokeTests.length > 0 && smokeTests.every(Boolean);

    yield {
        stepNumber: 0,
        entities: makeNodes("blue", "idle", "active"),
        edges: makeEdge("blue"),
        description: "Blue is live; green is idle and ready to receive the new build.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { active: "blue", greenReady, smokePassed, outcome: "in-progress", phase: 0 },
    };

    yield {
        stepNumber: 1,
        entities: makeNodes("blue", greenReady ? "unvisited" : "error", "active"),
        edges: makeEdge("blue"),
        description: greenReady
            ? "The new build is deployed to green while blue keeps serving traffic."
            : "Deployment to green failed; blue remains the live environment.",
        codeLineNumber: 1,
        layout: "graph",
        meta: { active: "blue", greenReady, smokePassed, outcome: "in-progress", phase: 1 },
    };

    if (!smokePassed) {
        yield {
            stepNumber: 2,
            entities: makeNodes("blue", "error", "active"),
            edges: makeEdge("blue"),
            description: "Smoke tests failed on green; the switch is aborted and blue stays live.",
            codeLineNumber: 3,
            layout: "graph",
            meta: { active: "blue", greenReady, smokePassed, outcome: "aborted", phase: 2 },
        };
        return;
    }

    yield {
        stepNumber: 2,
        entities: makeNodes("blue", "comparing", "active"),
        edges: makeEdge("blue"),
        description: "All smoke tests passed on green; the router is ready to switch.",
        codeLineNumber: 2,
        layout: "graph",
        meta: { active: "blue", greenReady, smokePassed, outcome: "in-progress", phase: 2 },
    };

    yield {
        stepNumber: 3,
        entities: makeNodes("blue", "active", "unvisited"),
        edges: makeEdge("green"),
        description: "The router switched atomically; green is now live and blue is on standby.",
        codeLineNumber: 4,
        layout: "graph",
        meta: { active: "green", greenReady, smokePassed, outcome: "switched", phase: 3 },
    };

    const finalActive = bakeSucceeded ? "green" : "blue";
    yield {
        stepNumber: 4,
        entities: bakeSucceeded
            ? makeNodes("blue", "active", "sorted")
            : makeNodes("blue", "error", "active"),
        edges: makeEdge(finalActive),
        description: bakeSucceeded
            ? "The bake succeeded; blue is decommissioned and green remains live."
            : "The bake failed; the router rolled back to the still-running blue environment.",
        codeLineNumber: bakeSucceeded ? 6 : 5,
        layout: "graph",
        meta: { active: finalActive, greenReady, smokePassed, outcome: bakeSucceeded ? "complete" : "rolled-back", phase: 4 },
    };
}

/** The blue-green deployment module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Two full environments run side by side. The old one serves all users while the new one is prepared in private. After it passes checks, a single router change sends everyone to the new version at once. Because the old environment is left intact, undoing a bad release is just as fast as making it.",
        invariants: [
            "Exactly one environment receives live traffic at any time.",
            "The router never switches unless every smoke test passes on green.",
            "Blue stays available as a rollback target until the bake period ends.",
        ],
        correctness:
            "The router edge always points to a single environment, matching the active variable. Smoke tests are combined with logical AND, so the switch occurs only when green is ready and all checks pass. If the bake fails, blue was never decommissioned and the router is pointed back to it, which restores the exact pre-deploy state. If the bake succeeds, blue is retired and green remains live.",
        complexityRationale:
            "The deployment is a fixed sequence of phases with constant work each, so time is O(1). Only three nodes and one edge are stored, giving O(1) space.",
        uses: [
            "Zero-downtime web application releases",
            "Database schema migrations paired with application versions",
            "Disaster recovery drills that need instant rollback",
        ],
        references: [
            "Humble and Farley, Continuous Delivery, chapter on deployment patterns",
            "Google SRE Book, Chapter 22 on releasing changes",
        ],
        workedExample:
            "Blue serves traffic while version two is deployed to green. Three smoke tests all pass, so the router switches to green in one step. During the bake, error rates stay low, so blue is decommissioned and green remains live. Had a test failed, blue would never have been switched away from.",
    },
    id: "blue-green-deployment",
    name: "Blue-Green Deployment",
    category: "production-systems",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { greenReady: true, smokeTests: [true, true, true], bakeSucceeded: true },
    visualType: "graph",
    run,
    pseudocode: [
        "start with blue live and green idle",
        "deploy the new build onto the green environment",
        "run smoke tests and require all to pass",
        "if tests fail then abort and keep blue live",
        "switch the router atomically so green is live",
        "monitor the bake period for errors",
        "on failure point the router back to blue",
        "done: keep green live and decommission blue",
    ],
};

export default module;
