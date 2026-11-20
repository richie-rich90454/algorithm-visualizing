/**
 * clarke-wright-savings.ts - Clarke-Wright Savings Heuristic
 *
 * The Clarke-Wright heuristic builds vehicle routes from a depot. Every pair
 * of customers has a saving equal to the distance saved by visiting them on
 * one trip instead of two separate trips. Pairs are considered from largest
 * saving down, and two routes are joined when the customers sit at route ends
 * and the combined demand still fits the vehicle capacity.
 *
 * Time: O(c^2 log c) for sorting the savings
 * Space: O(c^2) for the savings table
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface RoutingInput {
    depot: [number, number];
    customers: Array<[number, number]>;
    demand: number[];
    capacity: number;
}

interface Route {
    stops: number[];
    load: number;
}

function distance(a: [number, number], b: [number, number]): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<RoutingInput> | null) ?? {};
    const depot = task.depot ?? [0, 0];
    const customers = task.customers ?? [
        [1, 0],
        [2, 1],
        [0, 2],
        [-1, 1],
        [-2, 0],
    ];
    const demand = Array.isArray(task.demand) ? [...task.demand] : [2, 3, 1, 2, 2];
    const capacity = typeof task.capacity === "number" ? task.capacity : 6;
    const count = customers.length;
    const labelFor = (index: number): string => `C${index + 1}`;

    const toDepot = customers.map((point) => distance(depot, point));
    const savings: Array<{ i: number; j: number; value: number }> = [];
    for (let i = 0; i < count; i += 1) {
        for (let j = i + 1; j < count; j += 1) {
            const between = distance(customers[i] as [number, number], customers[j] as [number, number]);
            savings.push({ i, j, value: (toDepot[i] as number) + (toDepot[j] as number) - between });
        }
    }
    savings.sort((a, b) => b.value - a.value || a.i - b.i || a.j - b.j);

    let routes: Route[] = customers.map((_, index) => ({ stops: [index], load: demand[index] ?? 0 }));

    const makeEntities = (states: Map<number, EntityState>): VisualEntity[] => {
        const entities: VisualEntity[] = [
            {
                id: "node-depot",
                type: "node" as const,
                label: "Depot",
                value: "depot",
                state: "active" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index: -1, name: "Depot" },
            },
        ];
        for (let index = 0; index < count; index += 1) {
            entities.push({
                id: `node-${index}`,
                type: "node" as const,
                label: labelFor(index),
                value: index,
                state: states.get(index) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index, demand: demand[index] ?? 0 },
            });
        }
        return entities;
    };
    const makeEdges = (): VisualEdge[] => {
        const result: VisualEdge[] = [];
        routes.forEach((route, r) => {
            const sequence = ["node-depot", ...route.stops.map((stop) => `node-${stop}`), "node-depot"];
            for (let k = 0; k + 1 < sequence.length; k += 1) {
                result.push({
                    id: `edge-${r}-${k}`,
                    sourceId: sequence[k] as string,
                    targetId: sequence[k + 1] as string,
                    label: "",
                    state: "path" as EntityState,
                    directed: false,
                });
            }
        });
        return result;
    };

    let step = 0;
    let joined = 0;
    let totalSaving = 0;
    const frame = (states: Map<number, EntityState>, description: string, line: number): VisualFrame => {
        const result: VisualFrame = {
            stepNumber: step,
            entities: makeEntities(states),
            edges: makeEdges(),
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                customers: count,
                capacity,
                joined,
                totalSaving: Math.round(totalSaving * 1000) / 1000,
                savings: savings.map((entry) => Math.round(entry.value * 1000) / 1000),
                routes: routes.map((route) => route.stops.map((stop) => labelFor(stop)).join("-")),
            },
        };
        step += 1;
        return result;
    };

    yield frame(
        new Map(),
        `Computed ${savings.length} pairwise savings from depot distances.`,
        0,
    );

    for (const pair of savings) {
        const routeI = routes.findIndex((route) => route.stops.includes(pair.i));
        const routeJ = routes.findIndex((route) => route.stops.includes(pair.j));
        if (routeI < 0 || routeJ < 0 || routeI === routeJ) {
            continue;
        }
        const left = routes[routeI] as Route;
        const right = routes[routeJ] as Route;
        if (left.load + right.load > capacity) {
            continue;
        }
        const orient = (route: Route, endpoint: number): number[] | null => {
            if (route.stops[route.stops.length - 1] === endpoint) {
                return route.stops;
            }
            if (route.stops[0] === endpoint) {
                return [...route.stops].reverse();
            }
            return null;
        };
        const orientedLeft = orient(left, pair.i);
        const orientedRight = orient(right, pair.j);
        if (!orientedLeft || !orientedRight) {
            continue;
        }
        const merged: Route = {
            stops: [...orientedLeft, ...[...orientedRight].reverse()],
            load: left.load + right.load,
        };
        routes = routes.filter((_, index) => index !== routeI && index !== routeJ);
        routes.push(merged);
        joined += 1;
        totalSaving += pair.value;
        const states = new Map<number, EntityState>([
            [pair.i, "swapped"],
            [pair.j, "swapped"],
        ]);
        yield frame(
            states,
            `Joined ${labelFor(pair.i)} and ${labelFor(pair.j)} with saving ${pair.value.toFixed(2)}.`,
            3,
        );
    }

    yield frame(
        new Map(customers.map((_, index) => [index, "sorted" as EntityState])),
        `Built ${routes.length} route(s) with total saving ${totalSaving.toFixed(2)}.`,
        5,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Sending a truck to one customer and back costs twice that customer's depot distance. Visiting two customers on one trip instead saves the depot distance of the second customer minus the extra distance between them. Clarke-Wright ranks all such savings, then repeatedly joins route ends while the vehicle still has room.",
        invariants: [
            "Every customer appears in exactly one route.",
            "A route's demand never exceeds the vehicle capacity.",
            "Only end customers are joined, so the resulting route is a simple path from the depot and back.",
        ],
        correctness:
            "Each accepted merge removes two depot links and adds one inter-customer link, so it realizes exactly the computed saving. Restricting merges to route ends keeps every route a valid tour from the depot, and the capacity check keeps each tour feasible. The heuristic is not guaranteed optimal, but every route it outputs is feasible and its savings accounting is exact.",
        complexityRationale:
            "There are c(c-1)/2 savings values, sorting them costs O(c^2 log c), and scanning them with constant-time route lookups is O(c^2). The savings table uses O(c^2) space.",
        uses: [
            "Delivery and refuse-collection route planning",
            "A teaching introduction to vehicle routing heuristics",
            "A greedy baseline for comparing with metaheuristic routing methods",
        ],
        references: [
            "Clarke and Wright, Scheduling of Vehicles from a Central Depot, 1964",
            "Wikipedia: Vehicle routing problem, savings algorithm",
        ],
        workedExample:
            "With a depot at the origin, customers at (1, 0) and (0, 1) have depot distances 1 and 1 and mutual distance about 1.41, giving a saving of about 0.59. Merging their single-customer routes yields depot to (1, 0) to (0, 1) to depot, provided the combined demand fits the truck.",
    },
    id: "clarke-wright-savings",
    name: "Clarke-Wright Savings",
    category: "graph",
    complexity: { time: "O(c^2 log c)", space: "O(c^2)" },
    defaultInput: {
        depot: [0, 0],
        customers: [
            [1, 0],
            [2, 1],
            [0, 2],
            [-1, 1],
            [-2, 0],
        ],
        demand: [2, 3, 1, 2, 2],
        capacity: 6,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "compute each customer's distance from the depot",
        "for every customer pair, compute depot distance sum minus pair distance",
        "sort all savings from largest to smallest",
        "start one route per customer",
        "for each pair in savings order, join two different routes at their ends if capacity allows",
        "record the saving and continue to the next pair",
        "done: report the feasible routes and total saving",
    ],
};

export default module;
