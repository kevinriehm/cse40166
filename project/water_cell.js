// Generates a list of water cells, based on the camera's current position
function gen_cells() {
	var cells = (function split_cell(cell) {
		var x1 = cell.x - camera.xyz[0];
		var x2 = cell.x - camera.xyz[0] + cell.w;
		var y = Math.max(1, Math.abs(camera.xyz[1]));
		var z1 = cell.z - camera.xyz[2];
		var z2 = cell.z - camera.xyz[2] + cell.h;

		var lod0 = Math.atan(x1*z1/Math.sqrt(x1*x1 + y*y + z1*z1));
		var lod1 = Math.atan(x1*z2/Math.sqrt(x1*x1 + y*y + z2*z2));
		var lod2 = Math.atan(x2*z1/Math.sqrt(x2*x2 + y*y + z1*z1));
		var lod3 = Math.atan(x2*z2/Math.sqrt(x2*x2 + y*y + z2*z2));

		cell.lod = lod0 - lod1 - lod2 + lod3;

		if(cell.lod < lodbias) {
			cell.mv = mat4();
			cell.mv = mult(scalem(cell.w, 1, cell.h), cell.mv);
			cell.mv = mult(translate(cell.x, 0, cell.z), cell.mv);
			return [cell];
		}

		var w = cell.w/2;
		var h = cell.h/2;

		var nw = {x: cell.x,     z: cell.z + h, w: w, h: h, depth: cell.depth + 1};
		var ne = {x: cell.x + w, z: cell.z + h, w: w, h: h, depth: cell.depth + 1};
		var sw = {x: cell.x,     z: cell.z,     w: w, h: h, depth: cell.depth + 1};
		var se = {x: cell.x + w, z: cell.z,     w: w, h: h, depth: cell.depth + 1};

		nw.edges = {n: cell.edges.n, s: [sw], w: cell.edges.w, e: [ne]};
		ne.edges = {n: cell.edges.n, s: [se], w: [nw], e: cell.edges.e};
		sw.edges = {n: [nw], s: cell.edges.s, w: cell.edges.w, e: [se]};
		se.edges = {n: [ne], s: cell.edges.s, w: [sw], e: cell.edges.e};

		cell.edges.n.forEach(function(neighbor) {
			neighbor.edges.s = neighbor.edges.s.filter(function(x) { return x !== cell; });
			[nw, ne, sw, se].forEach(function(subcell) {
				if(neighbor.x <= subcell.x && subcell.x < neighbor.x + neighbor.w
					|| neighbor.x < subcell.x + subcell.w
						&& subcell.x + subcell.w <= neighbor.x + neighbor.w)
					neighbor.edges.s.push(subcell);
			});
		});

		cell.edges.s.forEach(function(neighbor) {
			neighbor.edges.n = neighbor.edges.n.filter(function(x) { return x !== cell; });
			[nw, ne, sw, se].forEach(function(subcell) {
				if(neighbor.x <= subcell.x && subcell.x < neighbor.x + neighbor.w
					|| neighbor.x < subcell.x + subcell.w
						&& subcell.x + subcell.w <= neighbor.x + neighbor.w)
					neighbor.edges.n.push(subcell);
			});
		});

		cell.edges.w.forEach(function(neighbor) {
			neighbor.edges.e = neighbor.edges.e.filter(function(x) { return x !== cell; });
			[nw, ne, sw, se].forEach(function(subcell) {
				if(neighbor.z <= subcell.z && subcell.z < neighbor.z + neighbor.h
					|| neighbor.z < subcell.z + subcell.h
						&& subcell.z + subcell.h <= neighbor.z + neighbor.h)
					neighbor.edges.e.push(subcell);
			});
		});

		cell.edges.e.forEach(function(neighbor) {
			neighbor.edges.w = neighbor.edges.w.filter(function(x) { return x !== cell; });
			[nw, ne, sw, se].forEach(function(subcell) {
				if(neighbor.z <= subcell.z && subcell.z < neighbor.z + neighbor.h
					|| neighbor.z < subcell.z + subcell.h
						&& subcell.z + subcell.h <= neighbor.z + neighbor.h)
					neighbor.edges.w.push(subcell);
			});
		});

		return [].concat(split_cell(nw), split_cell(ne), split_cell(sw), split_cell(se));
	})({
		// One corner
		x: camera.xyz[0] - horizon,
		z: camera.xyz[2] - horizon,

		// Dimensions
		w: 2*horizon,
		h: 2*horizon,

		// Neighbors
		edges: {n: [], s: [], w: [], e: []},

		depth: 0
	});

	cells.forEach(function(cell) {
		cell.seams = {
			n: cell.edges.n.length === 1 ? cell.depth - cell.edges.n[0].depth : 0,
			s: cell.edges.s.length === 1 ? cell.depth - cell.edges.s[0].depth : 0,
			w: cell.edges.w.length === 1 ? cell.depth - cell.edges.w[0].depth : 0,
			e: cell.edges.e.length === 1 ? cell.depth - cell.edges.e[0].depth : 0
		};
	});

	return cells;
}

