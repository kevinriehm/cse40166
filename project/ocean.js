// Global state
var gl;
var glhalf;
var glhalflinear;
var glmrt;

var programs;

var fbos;
var textures;

var camera;

// Geometry
var quad;
var water;

var cells;

// Configuration
var choppiness;
var horizon;
var lodbias;
var waterdim;
var wavesamplitude;
var wavesdim;
var wavesscale;
var wind;

var playing;

window.onload = function() {
	choppiness = 1; // Scaling factor for displacement vector
	horizon = 1000; // Maximum distance of water cells
	lodbias = 0.2; // Limit factor of cell division
	waterdim = 8; // Maximum resolution of a single water cell
	wavesamplitude = 1000; // Height of waves
	wavesdim = 64; // Resolution of wave heightmap
	wavesscale = 40; // World-space size of heightmap
	wind = vec2(8, 8); // Wind vector

	camera = {
		xyz: vec3(0, 6, -5),
		rot: vec3(0, 0, 0)
	};

	// Set up WebGL
	var canvas = document.getElementById('canvas');
	gl = WebGLUtils.setupWebGL(canvas);
	if(!gl) alert('WebGL unavailable');

	glhalf = gl.getExtension('OES_texture_half_float');
	glhalflinear = gl.getExtension('OES_texture_half_float_linear');
	glmrt = gl.getExtension('WEBGL_draw_buffers');

	gl.clearColor(0, 0, 0, 1);

	// Compile shaders
	programs = {
		fft_final: build_program('fft_final.v.glsl', 'fft_final.f.glsl'),
		fft_x: build_program('fft_x.v.glsl', 'fft_x.f.glsl'),
		fft_y: build_program('fft_y.v.glsl', 'fft_y.f.glsl'),
		spectrum: build_program('spectrum.v.glsl', 'spectrum.f.glsl'),
		water: build_program('water.v.glsl', 'water.f.glsl')
	};

	// Set up render targets
	textures = {};

	textures.spectrum_height = gen_wave_texture();
	textures.spectrum_slope = gen_wave_texture();
	textures.spectrum_disp = gen_wave_texture();

	textures.fft_height = [
		textures.spectrum_height,
		gen_wave_texture()
	];

	textures.fft_slope = [
		textures.spectrum_slope,
		gen_wave_texture()
	];

	textures.fft_disp = [
		textures.spectrum_disp,
		gen_wave_texture()
	];

	textures.waves0 = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, textures.waves0);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, wavesdim, wavesdim, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

	textures.waves1 = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, textures.waves1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, wavesdim, wavesdim, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

	fbos = {};

	fbos.spectrum = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.spectrum);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, glmrt.COLOR_ATTACHMENT0_WEBGL, gl.TEXTURE_2D, textures.spectrum_height, 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, glmrt.COLOR_ATTACHMENT1_WEBGL, gl.TEXTURE_2D, textures.spectrum_slope, 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, glmrt.COLOR_ATTACHMENT2_WEBGL, gl.TEXTURE_2D, textures.spectrum_disp, 0);
	glmrt.drawBuffersWEBGL([
		glmrt.COLOR_ATTACHMENT0_WEBGL,
		glmrt.COLOR_ATTACHMENT1_WEBGL,
		glmrt.COLOR_ATTACHMENT2_WEBGL
	]);

	fbos.fft = [
		fbos.spectrum,
		gl.createFramebuffer()
	];

	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.fft[1]);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, glmrt.COLOR_ATTACHMENT0_WEBGL, gl.TEXTURE_2D, textures.fft_height[1], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, glmrt.COLOR_ATTACHMENT1_WEBGL, gl.TEXTURE_2D, textures.fft_slope[1], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, glmrt.COLOR_ATTACHMENT2_WEBGL, gl.TEXTURE_2D, textures.fft_disp[1], 0);
	glmrt.drawBuffersWEBGL([
		glmrt.COLOR_ATTACHMENT0_WEBGL,
		glmrt.COLOR_ATTACHMENT1_WEBGL,
		glmrt.COLOR_ATTACHMENT2_WEBGL
	]);

	fbos.waves = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.waves);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, glmrt.COLOR_ATTACHMENT0_WEBGL, gl.TEXTURE_2D, textures.waves0, 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, glmrt.COLOR_ATTACHMENT1_WEBGL, gl.TEXTURE_2D, textures.waves1, 0);
	glmrt.drawBuffersWEBGL([
		glmrt.COLOR_ATTACHMENT0_WEBGL,
		glmrt.COLOR_ATTACHMENT1_WEBGL
	]);

	// Set up geometry
	quad = [
		vec2(-1, -1),
		vec2( 1, -1),
		vec2( 1,  1),
		vec2(-1,  1)
	];

	quad.buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(quad), gl.STATIC_DRAW);

	water = {
		points: [],
		indices: []
	};

	var dim = waterdim + 1;

	for(var y = 0; y < dim; y++)
		for(var x = 0; x < dim; x++)
			water.points.push(vec2(x/(dim - 1), y/(dim - 1)));

	for(var y = 0; y < dim - 1; y++) {
		water.indices.push(y*dim + (y&1 ? 0 : dim - 1));
		for(var x = 0; x < dim; x++)
			water.indices.push(
				y*dim + (y&1 ? x : dim - x - 1),
				(y + 1)*dim + (y&1 ? x : dim - x - 1)
			);
	}

	water.points.buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, water.points.buffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(water.points), gl.STATIC_DRAW);

	water.indices.buffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, water.indices.buffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(water.indices), gl.STATIC_DRAW);

	cells = gen_cells();

	// Hook up the controls
	document.getElementById('play').onclick = function() {
		playing = !playing;

		this.textContent = playing ? "Pause" : "Play";

		if(playing)
			window.requestAnimationFrame(render);
	};

	document.getElementById('wavesscale').onchange = function() {
		wavesscale = this.value;
		document.getElementById('wavesscaledisplay').textContent = this.value;
	};
	document.getElementById('wavesscale').dispatchEvent(new Event('change'));

	document.getElementById('choppiness').onchange = function() {
		choppiness = this.value;
		document.getElementById('choppinessdisplay').textContent = this.value;
	};
	document.getElementById('choppiness').dispatchEvent(new Event('change'));

	canvas.tabIndex = 9999;
	canvas.style.outline = 'none';
	canvas.onkeydown = function(e) {
		switch(e.keyCode) {
		case 37: camera.rot[1] += 1; break; // Left arrow
		case 38: camera.rot[0] += 1; break; // Up arrow
		case 39: camera.rot[1] -= 1; break; // Right arrow
		case 40: camera.rot[0] -= 1; break; // Down arrow
		}

		// Reasonable range clamping
		camera.rot[0] = Math.max(-90, Math.min(camera.rot[0], 90));
	};

	playing = false;
	window.requestAnimationFrame(render);
};

// Compile shaders and perform introspection on the attributes and uniforms
function build_program(vshader, fshader) {
	var array = /(.*)\[(\d*)\]/;

	var program = initShaders(gl, vshader, fshader);

	var nuniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
	var nattribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

	for(var ui = 0; ui < nuniforms; ui++) {
		var info = gl.getActiveUniform(program, ui);
		var loc = gl.getUniformLocation(program, info.name);
		var parts = info.name.match(array);
		if(parts) {
			program[parts[1]] = program[parts[1]] || [];
			program[parts[1]][parts[2]] = loc;
		} else program[info.name] = loc;
	}

	for(var ai = 0; ai < nattribs; ai++) {
		var info = gl.getActiveAttrib(program, ai);
		program[info.name] = gl.getAttribLocation(program, info.name)
	}

	return program;
}

// Creates a texture suitable for an intermediary step in the FFT process
function gen_wave_texture() {
	var tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, wavesdim, wavesdim, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	return tex;

}

// Generates a list of water cells, based on the camera's current position
function gen_cells() {
	var cells = (function split_cell(cell) {
		var x1 = cell.x - camera.xyz[0];
		var x2 = cell.x - camera.xyz[0] + cell.w;
		var y = Math.abs(camera.xyz[1]);
		var z1 = cell.z - camera.xyz[2];
		var z2 = cell.z - camera.xyz[2] + cell.h;

		var lod0 = Math.atan(x1*z1/Math.sqrt(x1*x1 + y*y + z1*z1));
		var lod1 = Math.atan(x1*z2/Math.sqrt(x1*x1 + y*y + z2*z2));
		var lod2 = Math.atan(x2*z1/Math.sqrt(x2*x2 + y*y + z1*z1));
		var lod3 = Math.atan(x2*z2/Math.sqrt(x2*x2 + y*y + z2*z2));

		var lod = lod0 - lod1 - lod2 + lod3;

		if(lod < lodbias) {
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

var prev;
var frames = 0;
function render(now) {
	var cam, mv;

	var nowsec = now/1000;

	// FPS counter
	if(!prev) prev = now;
	if(now - prev >= 1000) {
		prev += Math.floor((now - prev)/1000)*1000;
		console.log(frames);
		frames = 0;
	}
	frames++;

	// Rendering to spectrum FBO

	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.spectrum);
	gl.clear(gl.COLOR_BUFFER_BIT);

	// Wave spectrum at current time
	gl.useProgram(programs.spectrum);

	gl.disable(gl.DEPTH_TEST);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.spectrum.a_position);
	gl.vertexAttribPointer(programs.spectrum.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform2f(programs.spectrum.u_dim, wavesdim, wavesdim);
	gl.uniform2fv(programs.spectrum.u_wind, wind);
	gl.uniform1f(programs.spectrum.u_amplitude, wavesamplitude);
	gl.uniform1f(programs.spectrum.u_scale, wavesscale);

	gl.uniform1f(programs.spectrum.u_time, nowsec);

	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	// Rendering to wave FBO

	var niter = Math.round(Math.log(wavesdim)/Math.log(2));

	// Horizontal FFT
	gl.useProgram(programs.fft_x);

	gl.disable(gl.DEPTH_TEST);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.fft_x.a_position);
	gl.vertexAttribPointer(programs.fft_x.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	for(var i = 0; i < niter; i++) {
		var texin = i&1;

		gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.fft[texin^1]);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, textures.fft_height[texin]);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, textures.fft_slope[texin]);

		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, textures.fft_disp[texin]);

		gl.uniform1iv(programs.fft_x.u_in[0], [0, 1, 2]);

		gl.uniform2f(programs.fft_x.u_dim, wavesdim, wavesdim);

		gl.uniform1f(programs.fft_x.u_stage, i);

		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);
	}

	// Vertical FFT
	gl.useProgram(programs.fft_y);

	gl.disable(gl.DEPTH_TEST);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.fft_y.a_position);
	gl.vertexAttribPointer(programs.fft_y.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	for(var i = 0; i < niter; i++) {
		var texin = (niter + i)&1;

		gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.fft[texin^1]);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, textures.fft_height[texin]);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, textures.fft_slope[texin]);

		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, textures.fft_disp[texin]);

		gl.uniform1iv(programs.fft_y.u_in[0], [0, 1, 2]);

		gl.uniform2f(programs.fft_y.u_dim, wavesdim, wavesdim);

		gl.uniform1f(programs.fft_y.u_stage, i);

		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);
	}

	// Finalize FFT (sign change)
	gl.useProgram(programs.fft_final);

	gl.disable(gl.DEPTH_TEST);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.fft_final.a_position);
	gl.vertexAttribPointer(programs.fft_final.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.waves);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.fft_height[0]);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, textures.fft_slope[0]);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, textures.fft_disp[0]);

	gl.uniform1i(programs.fft_final.u_in[0], [0, 1, 2]);

	gl.uniform2f(programs.fft_final.u_dim, wavesdim, wavesdim);

	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	// Rendering to canvas

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.clear(gl.COLOR_BUFFER_BIT);

	// Water grid
	gl.useProgram(programs.water);

	gl.enable(gl.DEPTH_TEST);

	cam = mat4();
	cam = mult(translate(-camera.xyz[0], -camera.xyz[1], -camera.xyz[2]), cam);
	cam = mult(rotateZ(-camera.rot[2]), cam);
	cam = mult(rotateY(-camera.rot[1]), cam);
	cam = mult(rotateX(-camera.rot[0]), cam);
	cam = mult(perspective(100, 1/1, 0.1, horizon), cam);

	gl.bindBuffer(gl.ARRAY_BUFFER, water.points.buffer);
	gl.enableVertexAttribArray(programs.water.a_position);
	gl.vertexAttribPointer(programs.water.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, water.indices.buffer);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.waves0);
	gl.uniform1i(programs.water.u_waves[0], 0);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, textures.waves1);
	gl.uniform1i(programs.water.u_waves[1], 1);

	gl.uniformMatrix4fv(programs.water.u_camera, gl.FALSE, flatten(cam));
	gl.uniform3f(programs.water.u_color, 0.1, 0.4, 0.6);
	gl.uniform1f(programs.water.u_choppiness, choppiness);
	gl.uniform1f(programs.water.u_scale, wavesscale);

	cells.forEach(function(cell) {
		gl.uniformMatrix4fv(programs.water.u_modelview, gl.FALSE, flatten(cell.mv));

		gl.uniform1fv(programs.water.u_edgesize[0], [
			(1 << cell.seams.w)/waterdim,
			(1 << cell.seams.e)/waterdim,
			(1 << cell.seams.s)/waterdim,
			(1 << cell.seams.n)/waterdim
		]);

		gl.drawElements(gl.TRIANGLE_STRIP, water.indices.length, gl.UNSIGNED_SHORT, 0);
	});

	if(playing)
		window.requestAnimationFrame(render);
}

