// Global state
var gl;
var glhalf;
var glhalflinear;

var programs;

var fbos;
var textures;

var updatespectrum;

// Geometry
var quad;
var water;

// Configuration
var waterdim;
var wavesdim;
var wavesamplitude;
var wavesscale;
var wind;

window.onload = function() {
	waterdim = 128; // Maximum resolution of a single water cell
	wavesdim = 64; // Resolution of wave heightmap
	wavesamplitude = 10; // Height of waves
	wavesscale = 100; // World-space size of heightmap
	wind = vec2(1, 0); // Wind vector

	// Set up WebGL
	var canvas = document.getElementById('canvas');
	gl = WebGLUtils.setupWebGL(canvas);
	if(!gl) alert('WebGL unavailable');

	glhalf = gl.getExtension('OES_texture_half_float');
	glhalflinear = gl.getExtension('OES_texture_half_float_linear');

	gl.clearColor(0, 0, 0, 1);

	// Compile shaders
	programs = {
		spectrum: build_program('spectrum.v.glsl', 'spectrum.f.glsl'),
		water: build_program('water.v.glsl', 'water.f.glsl'),
		waves: build_program('waves.v.glsl', 'waves.f.glsl')
	};

	// Set up render targets
	textures = {};

	textures.spectrum = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, textures.spectrum);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, wavesdim, wavesdim, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

	textures.waves = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, textures.waves);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, wavesdim, wavesdim, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

	fbos = {};

	fbos.spectrum = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.spectrum);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.spectrum, 0);

	fbos.waves = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.waves);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.waves, 0);

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
		for(var x = 0; x < dim; x++)
			water.indices.push((y + 1)*dim + (y&1 ? dim - x - 1 : x),
				y*dim + (y&1 ? dim - x - 1 : x));
		water.indices.push((y + 2)*dim - 1);
	}

	water.points.buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, water.points.buffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(water.points), gl.STATIC_DRAW);

	water.indices.buffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, water.indices.buffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(water.indices), gl.STATIC_DRAW);

	// Begin rendering
	updatespectrum = true;
	window.requestAnimationFrame(render);
};

// Compile shaders and perform introspection on the attributes and uniforms
function build_program(vshader, fshader) {
	var program = initShaders(gl, vshader, fshader);

	var nuniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
	var nattribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

	for(var ui = 0; ui < nuniforms; ui++) {
		var info = gl.getActiveUniform(program, ui);
		program[info.name] = gl.getUniformLocation(program, info.name);
	}

	for(var ai = 0; ai < nattribs; ai++) {
		var info = gl.getActiveAttrib(program, ai);
		program[info.name] = gl.getAttribLocation(program, info.name)
	}

	return program;
}

function render(now) {
	var cam, mv;

	var nowsec = now/1000;

	// Rendering to spectrum FBO

	if(updatespectrum) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.spectrum);
		gl.clear(gl.COLOR_BUFFER_BIT);

		// Wave spectrum at t = 0
		gl.useProgram(programs.spectrum);

		gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
		gl.enableVertexAttribArray(programs.spectrum.a_position);
		gl.vertexAttribPointer(programs.spectrum.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

		gl.uniform2f(programs.spectrum.u_dim, wavesdim, wavesdim);
		gl.uniform2f(programs.spectrum.u_wind, 3, 3);
		gl.uniform1f(programs.spectrum.u_amplitude, wavesamplitude);
		gl.uniform1f(programs.spectrum.u_scale, wavesscale);

		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

		updatespectrum = false;
	}

	// Rendering to wave FBO

	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.waves);
	gl.clear(gl.COLOR_BUFFER_BIT);

	// Wave heightmap
	gl.useProgram(programs.waves);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.waves.a_position);
	gl.vertexAttribPointer(programs.waves.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.spectrum);
	gl.uniform1i(programs.waves.u_spectrum, 0);

	gl.uniform1f(programs.waves.u_scale, wavesscale);
	gl.uniform1f(programs.waves.u_time, nowsec/10);

	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	// Rendering to canvas

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.clear(gl.COLOR_BUFFER_BIT);

	// Water grid
	gl.useProgram(programs.water);

	cam = mat4();
//	cam = mult(translate(0, -1, -1), cam);
//	cam = mult(rotateX(45), cam);
//	cam = mult(perspective(100, 1/1, 0.1, 100), cam);

	mv = mat4();
	mv = mult(scalem(2, 2, 1), mv);
	mv = mult(translate(-1, -1, 0), mv);

	gl.bindBuffer(gl.ARRAY_BUFFER, water.points.buffer);
	gl.enableVertexAttribArray(programs.water.a_position);
	gl.vertexAttribPointer(programs.water.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, water.indices.buffer);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.waves);
	gl.uniform1i(programs.water.u_waves, 0);

	gl.uniformMatrix4fv(programs.water.u_camera, gl.FALSE, flatten(cam));
	gl.uniformMatrix4fv(programs.water.u_modelview, gl.FALSE, flatten(mv));
	gl.uniform3f(programs.water.u_color, 1, 1, 1);

	gl.drawElements(gl.TRIANGLE_STRIP, water.indices.length, gl.UNSIGNED_SHORT, 0);

//	window.requestAnimationFrame(render);
}

