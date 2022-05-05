const constant = (x: number) => {
    return function() {
        return x;
    };
}

type Node = any


export default function() {
    var nodes: Node[],
        alpha: number,
        strength = constant(-30),
        strengths: any[],
        indicesRepulse: any[],
        prevIndex = 0,
        distanceMin2 = 1,
        distanceMax2 = Infinity,
        neighborSize = function () {
          console.log('neighborSize')
          return 15;
        },
        updateSize = function (nodes: Node) { return Math.pow(nodes.length, 0.75); },
        sampleSize = function (nodes: Node) { return Math.pow(nodes.length, 0.25); },
        numNeighbors: number,
        numUpdate: number,
        numSamples: number,
        chargeMultiplier = function (nodes: Node) {
          console.log('chargeMultiplier')
          return nodes.length < 100 ? 1 : nodes.length < 200 ? 3 : Math.sqrt(nodes.length);
        },
        cMult: number,
        rand = Math.random;
  
    function addRandomNode(node: Node) {
      var randIdx = Math.floor(rand() * nodes.length),
          randNode = nodes[randIdx],
          randDist = (node.x - randNode.x) * (node.x - randNode.x) + (node.y - randNode.y) * (node.y - randNode.y),
          currIdx,
          currNode,
          currDist,
          maxI,
          maxDist = -Infinity,
          i = -1;
  
      // Is this already in the list?
      if (node.nearest.indexOf(randIdx) >= 0) return;
  
      // If there is room for another, add it.
      if (node.nearest.length < numNeighbors) {
        node.nearest.push(randIdx);
        return;
      }
  
      // Replace the farthest away "neighbor" with the new node.
      while (++i < node.nearest.length) {
        currIdx = node.nearest[i];
        currNode = nodes[currIdx];
        currDist = (node.x - currNode.x) * (node.x - currNode.x) - (node.y - currNode.y) * (node.y - currNode.y);
        if (currDist > maxDist) {
          maxI = i;
          maxDist = currDist;
        }
      }
  
      if (randDist < maxDist) {
        node.nearest[maxI as any] = randIdx;
      }
    }
  
    function getRandIndices(indices: any, num: number) {
      num = Math.floor(num);
      var i,
          n = nodes.length,
          cnt = n - num,
          randIdx,
          temp;
  
      // Choose random indices.
      for (i = n-1; i >= cnt; --i) {
        randIdx = Math.floor(rand() * i);
        temp = indices[randIdx];
        indices[randIdx] = indices[i];
        indices[i] = temp;
      }
  
      return indices.slice(cnt);
    }
  
    function approxRepulse(node: Node) {
      var i,
          randIndices,
          currNode,
          w,
          x,
          y,
          l;
  
      // Choose random nodes to update.
      randIndices = getRandIndices(indicesRepulse, numSamples);
  
      for (i = randIndices.length - 1; i >= 0; --i) {
        currNode = nodes[randIndices[i]];
  
        if (currNode === node) continue;
  
        x = currNode.x - node.x;
        y = currNode.y - node.y;
        l = x * x + y * y;
  
        if (l >= distanceMax2) continue;
  
        // Limit forces for very close nodes; randomize direction if coincident.
        if (x === 0) x = (rand() - 0.5) * 1e-6, l += x * x;
        if (y === 0) y = (rand() - 0.5) * 1e-6, l += y * y;
        if (l < distanceMin2) l = Math.sqrt(distanceMin2 * l);
  
        // @ts-ignore
        w = strengths[node.index] * alpha * cMult / l;
        node.vx += x * w;
        node.vy += y * w;
      }
    }
  
    function constantRepulse(node: Node) {
      var i,
          nearest,
          currNode,
          w,
          x,
          y,
          l;
  
      // Update the list of nearest nodes.
      if (numNeighbors) addRandomNode(node);
  
      nearest = node.nearest;
  
      if (numNeighbors) for (i = nearest.length - 1; i >= 0; --i) {
        currNode = nodes[nearest[i]];
  
        if (currNode === node) continue;
  
        x = currNode.x - node.x;
        y = currNode.y - node.y;
        l = x * x + y * y;
  
        if (l >= distanceMax2) continue;
  
        // Limit forces for very close nodes; randomize direction if coincident.
        if (x === 0) x = (rand() - 0.5) * 1e-6, l += x * x;
        if (y === 0) y = (rand() - 0.5) * 1e-6, l += y * y;
        if (l < distanceMin2) l = Math.sqrt(distanceMin2 * l);
  
        // @ts-ignore
        w = strengths[node.index] * alpha * cMult / l;
        node.vx += x * w;
        node.vy += y * w;
      }
    }
  
    function force(_: number) {
      var i = 0, j = prevIndex, n = nodes.length, upperIndex = prevIndex + numUpdate;
      for (alpha = _; i < n || j < upperIndex; ++i, ++j) {
        if (j < upperIndex) approxRepulse(nodes[j%n]);
        if (numNeighbors && i < n) constantRepulse(nodes[i]);
      }
      prevIndex = upperIndex % n;
    }
  
    function initialize() {
      if (!nodes) return;
      var i, n = nodes.length, node;
      indicesRepulse = new Array(n);
      for (i = 0; i < n; ++i) indicesRepulse[i] = i;
      strengths = new Array(n);
      
      // Cannot be negative.
      // @ts-ignore
      numNeighbors = Math.min(Math.ceil(neighborSize(nodes)), n);
      numNeighbors = numNeighbors < 0 ? 0 : Math.min(numNeighbors, nodes.length);
      numUpdate = Math.ceil(updateSize(nodes));
      numUpdate = numUpdate < 0 ? 0 : Math.min(numUpdate, n);
      numSamples = Math.ceil(sampleSize(nodes));
      numSamples = numSamples < 0 ? 0 : Math.min(numSamples, n);
  
      cMult = chargeMultiplier(nodes);
  
      alpha = 1;
      for (i = 0; i < n; ++i) {
        node = nodes[i];
        // @ts-ignore
        strengths[node.index] = +strength(node, i, nodes);
        node.nearest = [];
        while (node.nearest.length < numNeighbors) addRandomNode(node);
      }
    }
  
    force.initialize = function(_: Node[]) {
      nodes = _;
      initialize();
    };
  
    force.strength = function(_: any) {
      console.log(_, arguments.length, 'strength')
      return arguments.length ? (strength = typeof _ === "function" ? _ : constant(+_), initialize(), force) : strength;
    };
  
    force.distanceMin = function(_: any) {
      return arguments.length ? (distanceMin2 = _ * _, force) : Math.sqrt(distanceMin2);
    };
  
    force.distanceMax = function(_: any) {
      return arguments.length ? (distanceMax2 = _ * _, force) : Math.sqrt(distanceMax2);
    };
  
    force.neighborSize = function(_: any) {
      return arguments.length ? (neighborSize = typeof _ === "function" ? _ : constant(+_), initialize(), force) : neighborSize;
    };
  
    force.updateSize = function(_: any) {
      return arguments.length ? (updateSize = typeof _ === "function" ? _ : constant(+_), initialize(), force) : updateSize;
    };
  
    force.sampleSize = function(_: any) {
      return arguments.length ? (sampleSize = typeof _ === "function" ? _ : constant(+_), initialize(), force) : sampleSize;
    };
  
    force.chargeMultiplier = function(_: any) {
      return arguments.length ? (chargeMultiplier = typeof _ === "function" ? _ : constant(+_), initialize(), force) : chargeMultiplier;
    };
  
    force.source = function(_: any) {
      return arguments.length ? (rand = _, force) : rand;
    };
  
    return force;
  }
  