import React, { useState, useEffect, useRef } from "react";

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
} from "pixi.js";

import SmoothFollow from "../utils/SmoothFollow";

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

let gfxIDMap: { [key: string]: Sprite } = {};

let gfxMap: WeakMap<any, Sprite> = new WeakMap();

let nodeMap: WeakMap<Sprite, any> = new WeakMap();

export interface GraphProps {
  data: Data;
}

const Graph: React.FC<GraphProps> = (props) => {
  const root = useRef<HTMLCanvasElement>(null);
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

      renderer = app.renderer;

      stage = new Container();
      container = new Container();
      stage.addChild(container);
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
      // @ts-ignore
      renderer.render(graphics, texture);

      data.nodes.forEach((node) => {
        const gfx = new Sprite(texture);
        gfx.anchor.set(0.5);
        gfx.interactive = true;
        gfx.buttonMode = true;
        gfx.dragging = false;
        gfx.hitArea = new Circle(0, 0, NODE_HIT_RADIUS);
        // gfx.on("pointerdown", onDragStart);
        // gfx.on("pointerup", onDragEnd);
        // gfx.on("pointerupoutside", onDragEnd);
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

      simulation
        .force(
          "charge",
          d3.forceManyBody().strength(-FORCE_LAYOUT_NODE_REPULSION_STRENGTH)
        )
        .force(
          "center",
          d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2)
        )
        // .tick(FORCE_LAYOUT_ITERATIONS)
        // .on('tick', updatePositionsFromMainThreadSimulation)
        .stop();
    }
  };

  const updateInterpolatedPositions = () => {
    if (data?.nodes) {
      for (let i = 0; i < data.nodes.length; i++) {
        const node = data.nodes[i];
        // const gfx = gfxMap.get(node);
        const gfx = gfxIDMap[node.id];
        // gfx.position = new PIXI.Point(x, y);
        gfx.smoothFollowX.loop(delta);
        gfx.smoothFollowY.loop(delta);
        gfx.position.x = gfx.smoothFollowX.getSmooth();
        gfx.position.y = gfx.smoothFollowY.getSmooth();
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
      updatePositionsFromMainThreadSimulation();
      drawLines();
      renderer.render(stage);
    }
    requestAnimationFrame(render);
  };

  useEffect(() => {
    init();
    render();
  }, []);

  return <canvas ref={root}></canvas>;
};

export default Graph;
