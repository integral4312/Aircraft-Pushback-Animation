export class Node {
  constructor(x, y, navigable = true) {
    this.x = x;
    this.y = y;
    this.navigable = navigable;
    this.g = 0;
    this.h = 0;
    this.f = 0;
    this.parent = null;
    this.occupied = false;
  }
}

export class Grid {
  constructor(gridSize, canvas) {
    this.size = gridSize;
    this.tileSize = canvas.width / this.size;
    this.grid = this.buildGrid();
  }

  buildGrid() {
    const grid = [];
    const rows = this.size;
    const columns = this.size;

    for (let x = 0; x < columns; x++) {
      const row = [];
      for (let y = 0; y < rows; y++) {
        row.push(new Node(x, y, true));
      }
      grid.push(row);
    }

    return grid;
  }
}

export class PathHandler {
  constructor(grid) {
    this.grid = grid;
  }

  heuristic(a, b) {
    return Math.sqrt((a.x - b.x)**2, (a.y - b.y)^2);
  }

  getNeighborNodes(node) {
    const neighbors = [];
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1]
    ];

    for (const [dx, dy] of directions) {
      const x = node.x + dx;
      const y = node.y + dy;

      if (
        this.grid.grid[x] &&
        this.grid.grid[x][y] &&
        this.grid.grid[x][y].navigable
      ) {
        neighbors.push(this.grid.grid[x][y]);
      }
    }

    return neighbors;
  }

  aStar(startNode, goalNode) {
    if (!startNode || !goalNode) return;

    // Create the open set (priority queue) and closed set (nodes that have already been evaluated)
    let openSet = [startNode];
    let closedSet = new Set();

    // Reset the values of each node
    for (const row of this.grid.grid) {
      for (const node of row) {
        node.g = 0;
        node.h = 0;
        node.f = 0;
        node.parent = null;
      }
    }

    // While the length of the open set is not zero, construct a path
    while (openSet.length > 0) {
      // Sort by the lowest f-cost node
      openSet.sort((a, b) => a.f - b.f);

      // Set the current node as the lowest f-cost node
      const currentNode = openSet.shift();

      // If the current node is the goal node, that means that the path has been found,
      // so reconstruct the path
      if (currentNode === goalNode) {
        // Reconstruct the path
        let path = [];
        let temp = currentNode;

        while (temp) {
          path.push([temp.x, temp.y]);
          temp = temp.parent;
        }

        currentNode.occupied = true;
        return path.reverse();
      }

      // Add the current node to the closed set (it has been evaluated)
      closedSet.add(currentNode);

      // Iterate through the neighboring nodes of the current node
      for (const neighbor of this.getNeighborNodes(currentNode)) {
        // If the current neighbor node has been evaluated already, continue
        if (closedSet.has(neighbor)) continue;

        // Calculate a new g-cost for the neighbor node
        const tentativeG = currentNode.g + 1;

        // If the current g-cost is better than the new one, or the neighbor
        // is not in the open set:
        if (!openSet.includes(neighbor) || tentativeG < neighbor.g) {
          // Update the g-cost, h-cost, f-cost, and parent of the neighbor node
          neighbor.g = tentativeG;
          neighbor.h = this.heuristic(neighbor, goalNode);
          neighbor.f = neighbor.g + neighbor.h;
          neighbor.parent = currentNode;

          // If the open set does not contain the neighbor node,
          // add it to the open set
          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    // Return an empty path (no path was found)
    return [];
  }
}
