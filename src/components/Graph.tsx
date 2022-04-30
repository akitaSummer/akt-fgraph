import React, { useState, useEffect, useRef } from "react";
import { wrap, transfer, Remote } from "comlink";
import * as d3 from "d3";
import {
  RenderTexture,
  BaseRenderTexture,
  Application,
  Graphics,
  Sprite,
  SCALE_MODES,
  Circle,
  Container,
  Renderer,
  AbstractRenderer,
  autoDetectRenderer,
  InteractionData,
} from "pixi.js";

import EventEmitter from "eventemitter3";

import SmoothFollow from "../utils/SmoothFollow";

const workerFactory = wrap<typeof import("../workers/d3.worker").D3Computor>(
  new Worker(new URL("../workers/d3.worker.ts", import.meta.url), {
    type: "module",
  })
);

type Data = any;

const FORCE_LAYOUT_NODE_REPULSION_STRENGTH = 5;
const NODE_RADIUS = 2.5;
const NODE_HIT_WIDTH = 5.0;
const NODE_HIT_RADIUS = NODE_RADIUS + NODE_HIT_WIDTH;
const ALPHA = 0.5;
const ALPHA_DECAY = 0.01;
const ALPHA_TARGET = 0.05;

let delta = 1 / 60;

let renderer: Renderer | AbstractRenderer;

let data: Data;

let stage: Container;

let container: Container;

let linksGfx: Graphics;

let simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>;

let app: Application;

let gfxIDMap: { [key: string]: GraphSprite } = {};

let gfxMap: WeakMap<any, GraphSprite> = new WeakMap();

let nodeMap: WeakMap<GraphSprite, any> = new WeakMap();

let worker: Remote<import("../workers/d3.worker").D3Computor>;

let nodesBuffer: Float32Array;

let draggingNode: any;

let draggingNodeGraphSprite: GraphSprite;

export interface GraphProps {
  data: Data;
}

interface GraphSprite extends Sprite {
  dragging: boolean;
  smoothFollowX: SmoothFollow;
  smoothFollowY: SmoothFollow;
  data?: InteractionData;
}

const Graph: React.FC<GraphProps> = (props) => {
  const root = useRef<HTMLCanvasElement>(null);
  const [sendTime, setSendTime] = useState<number>(0);
  const init = () => {
    if (root.current) {
      data = props.data;

      app = new Application({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x000000,
        autoDensity: true,
        antialias: true,
        view: root.current,
        resolution: window.devicePixelRatio || 1,
      });
      if (!(worker instanceof Promise)) {
        //@ts-ignore
        worker = new workerFactory().then(async (w) => {
          setSendTime(Date.now());
          worker = w;
          nodesBuffer = new Float32Array(data.nodes.length * 2);
          nodesBuffer = await worker.createSimulation(
            data,
            {
              alpha: ALPHA,
              alphaDecay: ALPHA_DECAY,
              alphaTarget: ALPHA_TARGET,
              iterations: 1,
              nodeRepulsionStrength: FORCE_LAYOUT_NODE_REPULSION_STRENGTH,
              width: window.innerWidth,
              height: window.innerHeight,
            },
            transfer(nodesBuffer, [nodesBuffer.buffer])
          );

          updateNodesFromBuffer();
        });
      }

      window.addEventListener("resize", function () {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.resize(width, height);
        updateMainThreadSimulation(width, height);
      });

      renderer = app.renderer;

      stage = new Container();
      container = new Container();
      stage.addChild(container);
      container.mask = null;
      linksGfx = new Graphics();
      linksGfx.alpha = 0.6;
      container.addChild(linksGfx);

      const brt = new BaseRenderTexture({
        width: NODE_RADIUS * 2 + 2.0,
        height: NODE_RADIUS * 2 + 2.0,
        scaleMode: SCALE_MODES.LINEAR,
        resolution: window.devicePixelRatio || 1,
      });

      const texture = new RenderTexture(brt);
      const graphics = new Graphics();
      graphics.lineStyle(1.0, 0x000000);
      graphics.beginFill(0xffffff);
      graphics.drawCircle(0, 0, NODE_RADIUS);
      graphics.position.x = NODE_RADIUS + 1.0;
      graphics.position.y = NODE_RADIUS + 1.0;
      renderer.render(graphics, {
        renderTexture: texture,
      });

      data.nodes.forEach((node) => {
        const gfx = new Sprite(texture) as GraphSprite;
        gfx.anchor.set(0.5);
        gfx.interactive = true;
        gfx.buttonMode = true;
        gfx.dragging = false;
        gfx.hitArea = new Circle(0, 0, NODE_HIT_RADIUS);
        gfx.on("pointerdown", onDragStart);
        gfx.on("pointerup", onDragEnd);
        gfx.on("pointerupoutside", onDragEnd);
        // gfx.on("pointermove", onDragMove);
        gfx.smoothFollowX = new SmoothFollow();
        gfx.smoothFollowY = new SmoothFollow();
        gfx.smoothFollowX.set(window.innerWidth / 2);
        gfx.smoothFollowY.set(window.innerHeight / 2);

        container.addChild(gfx);
        gfxIDMap[node.id] = gfx;
        gfxMap.set(node, gfx);
        nodeMap.set(gfx, node);
      });

      const { nodes, links } = data;

      simulation = d3
        .forceSimulation()
        .nodes(nodes)
        .force(
          "link",
          d3.forceLink(links).id((d) => d.id)
        )
        .alpha(ALPHA)
        .alphaDecay(ALPHA_DECAY)
        .alphaTarget(ALPHA_TARGET);

      updateMainThreadSimulation(window.innerWidth, window.innerHeight);
    }
  };

  const updateMainThreadSimulation = (width: number, height: number) => {
    // const { nodes, links } = graph;

    simulation
      .force(
        "charge",
        d3.forceManyBody().strength(-FORCE_LAYOUT_NODE_REPULSION_STRENGTH)
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      // .tick(FORCE_LAYOUT_ITERATIONS)
      // .on('tick', updatePositionsFromMainThreadSimulation)
      .stop();
  };

  const updateWorkerBuffers = async () => {
    if (worker) {
      setSendTime(Date.now());
      nodesBuffer = await worker.updateWorkerBuffers(
        {
          iterations: 1,
          nodeRepulsionStrength: FORCE_LAYOUT_NODE_REPULSION_STRENGTH,
          width: window.innerWidth,
          height: window.innerHeight,
        },
        transfer(nodesBuffer, [nodesBuffer.buffer])
      );

      updateNodesFromBuffer();
    }
  };

  const updateNodesFromBuffer = () => {
    for (var i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      if (draggingNode !== node) {
        // const gfx = gfxMap.get(node);
        const gfx = gfxIDMap[node.id];
        // gfx.position = new PIXI.Point(x, y);

        gfx.smoothFollowX.set((node.x = nodesBuffer[i * 2 + 0]));
        gfx.smoothFollowY.set((node.y = nodesBuffer[i * 2 + 1]));
      }
    }

    let delay = delta * 1000 - (Date.now() - sendTime);
    if (delay < 0) {
      delay = 0;
    }
    setTimeout(updateWorkerBuffers, delay);
  };

  const updateInterpolatedPositions = () => {
    if (data?.nodes) {
      for (let i = 0; i < data.nodes.length; i++) {
        const node = data.nodes[i];
        if (draggingNode !== node) {
          // const gfx = gfxMap.get(node);
          const gfx = gfxIDMap[node.id];
          // gfx.position = new PIXI.Point(x, y);
          gfx.smoothFollowX.loop(delta);
          gfx.smoothFollowY.loop(delta);
          gfx.position.x = gfx.smoothFollowX.getSmooth();
          gfx.position.y = gfx.smoothFollowY.getSmooth();
        }
      }
    }
  };

  const updatePositionsFromMainThreadSimulation = () => {
    if (simulation && data?.nodes) {
      simulation.tick(1);
      data.nodes.forEach((node) => {
        let { x, y } = node;
        const gfx = gfxMap.get(node);
        if (gfx) {
          gfx.smoothFollowX.set(node.x);
          gfx.smoothFollowY.set(node.y);
        }
      });
    }
  };

  const drawLines = () => {
    if (linksGfx && data?.links) {
      linksGfx.clear();
      data.links.forEach((link) => {
        const source = gfxIDMap[link.source.id || link.source];
        const target = gfxIDMap[link.target.id || link.target];

        if (source && target) {
          // linksGfx.lineStyle(Math.sqrt(link.value), 0x999999);
          linksGfx.lineStyle(1.0, 0x999999);
          linksGfx.moveTo(source.x, source.y);
          linksGfx.lineTo(target.x, target.y);
        }
      });

      linksGfx.endFill();
    }
  };
  const render = () => {
    if (renderer && stage) {
      updateInterpolatedPositions();

      //   updatePositionsFromMainThreadSimulation();
      drawLines();
      renderer.render(stage);
    }
    requestAnimationFrame(render);
  };

  const onDragStart: EventEmitter.ListenerFn = (event) => {
    draggingNode = nodeMap.get(event.target);

    draggingNodeGraphSprite = event.target as GraphSprite;

    const target = event.target as GraphSprite;
    // console.log(target, draggingNode, event.global, "target");

    target.data = event.data;
    target.alpha = 0.5;
    target.dragging = true;

    target.dragOffset = target.data?.getLocalPosition(target.parent);
    target.dragOffset.x -= target.position.x;
    target.dragOffset.y -= target.position.y;

    target.addListener("pointermove", onDragMove);

    // enable node dragging
    // app.renderer.plugins.interaction.on('mousemove', appMouseMove);

    // disable viewport dragging
    // viewport.pause = true;
  };

  const onDragMove: EventEmitter.ListenerFn = (event) => {
    if (draggingNodeGraphSprite && draggingNode) {
      const newPosition = draggingNodeGraphSprite.data?.getLocalPosition(
        draggingNodeGraphSprite.parent
      );
      if (newPosition) {
        draggingNode.fx =
          draggingNode.x =
          draggingNodeGraphSprite.x =
            newPosition.x - draggingNodeGraphSprite.dragOffset.x;
        draggingNode.fy =
          draggingNode.y =
          draggingNodeGraphSprite.y =
            newPosition.y - draggingNodeGraphSprite.dragOffset.y;
      }
    }
  };

  const updateWorkerNodePositions = () => {
    if (worker) {
      worker.updateWorkerNodePositions(data.nodes);
    }
  };

  const onDragEnd: EventEmitter.ListenerFn = (event) => {
    if (draggingNode) {
      draggingNodeGraphSprite.smoothFollowX.reset(
        draggingNodeGraphSprite.position.x
      );
      draggingNodeGraphSprite.smoothFollowY.reset(
        draggingNodeGraphSprite.position.y
      );

      updateWorkerNodePositions();

      draggingNode.fx = null;
      draggingNode.fy = null;
    }

    draggingNode = undefined;

    draggingNodeGraphSprite.alpha = 1;
    draggingNodeGraphSprite.dragging = false;
    // set the interaction data to null
    draggingNodeGraphSprite.data = null;

    draggingNodeGraphSprite.removeListener("pointermove", onDragMove);

    draggingNodeGraphSprite = undefined;

    // disable node dragging
    // app.renderer.plugins.interaction.off('mousemove', appMouseMove);
    // enable viewport dragging
    // viewport.pause = false;
  };

  useEffect(() => {
    init();
    render();
  }, []);

  return <canvas ref={root}></canvas>;
};

export default Graph;
