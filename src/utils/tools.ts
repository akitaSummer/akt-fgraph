import * as d3 from "d3";
import { Node, Link } from "../types";

export const createRandomGraph = (numNodes: number, numLinks: number) => {
  const nodes = d3.range(numNodes).map((n) => ({ id: "node" + n }));
  const links = [];
  if (nodes.length > 1) {
    for (var i = 0; i < numLinks; i++) {
      const elements = getRandomArrayElements(nodes, 2);
      links.push({
        source: elements[0].id,
        target: elements[1].id,
        value: getRandomIndex(10),
      });
    }
  }

  return { nodes, links };
};

export const getRandomIndex = (length: number) => {
  return Math.round(Math.random() * (length - 1));
};

export const getRandomArrayElements = (
  arr: { id: string }[],
  numMax: number
) => {
  const shuffled = arr.slice(0);
  let i = arr.length;
  const min = Math.max(0, i - numMax);
  let temp: { id: string };
  let index: number;
  while (i-- > min) {
    index = Math.floor((i + 1) * Math.random());
    temp = shuffled[index];
    shuffled[index] = shuffled[i];
    shuffled[i] = temp;
  }
  return shuffled.slice(min);
};

const range = (n: number) => new Array(n).fill(undefined).map((_, i) => i);

export const colour = (function () {
  const scale = d3.scaleOrdinal(d3.schemeCategory10);
  return (num: any) => parseInt(scale(num).slice(1), 16);
})();
