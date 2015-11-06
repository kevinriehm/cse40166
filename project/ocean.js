// Global state
var gl;
var programs;

// Geometry
var water;

window.onload = function() {
	var waterresolution = 10;

	// Set up WebGL
	var canvas = document.getElementById('canvas');
	gl = WebGLUtils.setupWebGL(canvas);
	if(!gl) alert('WebGL unavailable');

	gl.clearColor(0, 0, 0, 1);

	// Compile shaders
	programs = {
		water: build_program('water.v.glsl', 'water.f.glsl')
	};

	// Set up geometry
	water = {
		points: [],
		indices: []
	};

	var dim = waterresolution + 1;

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

	render();
};

// Compile shaders and perform introspection
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

function render() {
	var mv;

	gl.clear(gl.COLOR_BUFFER_BIT);

	// Water grid
	gl.useProgram(programs.water);

	mv = mat4();
	mv = mult(scalem(2, 2, 1), mv);
	mv = mult(translate(-1, -1, 0), mv);

	gl.bindBuffer(gl.ARRAY_BUFFER, water.points.buffer);
	gl.enableVertexAttribArray(programs.water.a_position);
	gl.vertexAttribPointer(programs.water.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, water.indices.buffer);

	gl.uniformMatrix4fv(programs.water.u_modelview, gl.FALSE, flatten(mv));
	gl.uniform3f(programs.water.u_color, 0, 0, 1);

	gl.drawElements(gl.TRIANGLE_STRIP, water.indices.length, gl.UNSIGNED_SHORT, 0);

	window.requestAnimationFrame(render);
}

