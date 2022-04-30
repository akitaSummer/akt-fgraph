import { expose, transfer } from "comlink";

import * as d3 from "d3";

type SetRequired<T, K extends keyof T> = T & {
  [P in K]-?: T[P];
};

export interface D3ComputorOptions {
  alpha?: number;
  alphaDecay?: number;
  alphaTarget?: number;
  iterations?: number;
  nodeRepulsionStrength?:
    | number
    | ((
        d: d3.SimulationNodeDatum,
        i: number,
        data: d3.SimulationNodeDatum[]
      ) => number);
  width: number;
  height: number;
}

export class D3Computor {
  simulation?: d3.Simulation<d3.SimulationNodeDatum, undefined>;
  graph?: any;

  createSimulation(
    graph: any,
    options: SetRequired<
      D3ComputorOptions,
      "alpha" | "alphaDecay" | "alphaTarget" | "nodeRepulsionStrength"
    >,
    nodesBuffer: Float32Array
  ) {
    if (!this.graph) {
      this.graph = graph;
    }
    if (!this.simulation) {
      const {
        alpha,
        alphaDecay,
        alphaTarget,
        iterations,
        nodeRepulsionStrength,
        width,
        height,
      } = options;
      const { nodes, links } = graph;

      this.simulation = d3
        .forceSimulation()
        .alpha(alpha)
        .alphaDecay(alphaDecay)
        .alphaTarget(alphaTarget)
        .nodes(nodes)
        .force(
          "link",
          //@ts-ignore
          d3.forceLink(links).id((d) => d.id)
        )
        .force("charge", d3.forceManyBody().strength(-nodeRepulsionStrength))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .tick(iterations)
        .stop();
    }

    for (var i = 0; i < graph.nodes.length; i++) {
      var node = graph.nodes[i];
      nodesBuffer[i * 2 + 0] = node.x;
      nodesBuffer[i * 2 + 1] = node.y;
    }

    return transfer(nodesBuffer, [nodesBuffer.buffer]);
  }

  updateWorkerGraph(graph: any) {
    this.graph = graph;
    if (this.simulation) {
      this.simulation.nodes(graph.nodes).force(
        "link",
        //@ts-ignore
        d3.forceLink(graph.links).id((d) => d.id)
      );
    }
  }

  updateWorkerNodePositions(nodes: d3.SimulationNodeDatum[]) {
    if (this.simulation) {
      const n = this.simulation.nodes();
      for (let i = 0; i < n.length; i++) {
        n[i].x = nodes[i].x;
        n[i].y = nodes[i].y;
      }
    }
  }

  updateWorkerBuffers(options: D3ComputorOptions, nodesBuffer: Float32Array) {
    if (this.simulation) {
      const { iterations, width, height } = options;

      this.simulation
        .force("center", d3.forceCenter(width / 2, height / 2))
        .tick(iterations);
    }

    if (this.graph) {
      for (var i = 0; i < this.graph.nodes.length; i++) {
        var node = this.graph.nodes[i];
        nodesBuffer[i * 2 + 0] = node.x;
        nodesBuffer[i * 2 + 1] = node.y;
      }
    }

    return transfer(nodesBuffer, [nodesBuffer.buffer]);
  }
}

expose(D3Computor);
