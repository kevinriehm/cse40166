"use strict";

// Global state
var gl;
var attribs;
var uniforms;

var controls;

var currentday;
var prevnow;

var dayspersecond;
var orbit;
var sphere;
var planets;

var orbitcolor;
var orreytilt;

window.onload = function() {
	// Connect with the controls
	controls = {
		faster: document.getElementById('faster'),
		slower: document.getElementById('slower'),

		orbiton: document.getElementById('orbiton'),
		dayon: document.getElementById('dayon'),
		animon: document.getElementById('animon'),

		day: document.getElementById('day')
	};

	controls.faster.onclick = function() {
		dayspersecond *= 2;
	};

	controls.slower.onclick = function() {
		dayspersecond /= 2;
	};

	// Set up WebGL
	var canvas = document.getElementById('canvas');
	gl = WebGLUtils.setupWebGL(canvas);
	if(!gl) alert('WebGL unavailable');

	gl.clearColor(0, 0, 0, 1);

	gl.enable(gl.DEPTH_TEST);

	// Construct the shading program
	var program = initShaders(gl, 'basic.v.glsl', 'basic.f.glsl');
	gl.useProgram(program);

	attribs = {
		position: find_attribute(program, 'a_position')
	};

	gl.enableVertexAttribArray(attribs.position);

	uniforms = {
		modelview: find_uniform(program, 'u_modelview'),
		projection: find_uniform(program, 'u_projection'),
		color: find_uniform(program, 'u_color')
	};

	// Construct the solar system
	orbit = gen_orbit();
	sphere = gen_sphere();

	planets = [
		{
			// Sun
			color: vec3(1, 1, 0),
			radius: 696300,
			orbit: 0,
			period: 1
		}, {
			// Mercury
			color: vec3(1, 0, 0),
			radius: 2440,
			orbit: 57.91e6,
			period: 88
		}, {
			// Venus
			color: vec3(0, 1, 0),
			radius: 6052,
			orbit: 108.2e6,
			period: 225
		}, {
			// Earth
			color: vec3(0, 0, 1),
			radius: 6371,
			orbit: 149.6e6,
			period: 365,
			children: [
				{
					// Moon
					color: vec3(1, 1, 1),
					radius: 1737.4,
					orbit: 384472,
					period: 27
				}
			]
		}
	];

	orbitcolor = vec3(1, 1, 1);
	orreytilt = 60; // Degrees

	// Set up other state
	currentday = 0;

	dayspersecond = 30;

	// Start rendering
	window.requestAnimationFrame(render);
};

function calc_modelview(position, scale, rotation) {
	var m = mat4();

	m = mult(m, translate(position[0], position[1], position[2]));
	m = mult(m, rotateY(rotation[0]));
	m = mult(m, rotateX(rotation[1]));
	m = mult(m, rotateZ(rotation[2]));
	m = mult(m, scalem(scale[0], scale[1], scale[2]));

	return m;
}

function calc_projection(left, right, bottom, top, near, far, angle) {
	var m = mat4();

	m = mult(m, ortho(left, right, bottom, top, near, far));
	m = mult(m, rotateX(angle));

	return m;
}

function find_attribute(program, name) {
	var loc = gl.getAttribLocation(program, name);

	if(loc === null)
		console.warn('cannot find attribute ' + name);

	return loc;
}

function find_uniform(program, name) {
	var loc = gl.getUniformLocation(program, name);

	if(loc === null)
		console.warn('cannot find uniform ' + name);

	return loc;
}

function gen_orbit() {
	var npoints = 100;

	var vertices = [];

	for(var pointi = 0; pointi < npoints; pointi++) {
		var angle = pointi/(npoints - 1)*2*Math.PI;
		vertices.push(vec3(Math.sin(angle), Math.cos(angle), 0));
	}

	var vbo = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

	return {
		nvertices: vertices.length,
		vbo: vbo
	};
}

function gen_sphere() {
	var nstrips = 30;
	var nrows = 10;

	var vertices = [];

	for(var stripi = 0; stripi < nstrips; stripi++) {
		var theta1 = stripi/nstrips*2*Math.PI;
		var theta2 = (stripi + 1)/nstrips*2*Math.PI;

		vertices.push(vec3(0, 0, 1));

		for(var rowi = 0; rowi < nrows; rowi++) {
			var phi = (rowi + 1)/(nrows + 2)*Math.PI;

			vertices.push(vec3(
				Math.sin(phi)*Math.cos(theta1),
				Math.sin(phi)*Math.sin(theta1),
				Math.cos(phi)
			));

			vertices.push(vec3(
				Math.sin(phi)*Math.cos(theta2),
				Math.sin(phi)*Math.sin(theta2),
				Math.cos(phi)
			));
		}

		vertices.push(vec3(0, 0, -1));
	}

	var vbo = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

	return {
		nvertices: vertices.length,
		vbo: vbo
	};
}

function render_planet(planet, hiermatrix, day, level) {
	// Heuristics to make everything look right
	var orbitmag = Math.pow(40, level)*planet.orbit;

	var radius = (planet.radius - 1737.4)/(696300 - 1737.4);
	radius = Math.pow(radius, 0.28);
	radius = 0.03 + (0.3 - 0.03)*radius;
	radius = 1e8*radius;

	// Planet model-view matrix
	var angle = day/planet.period*2*Math.PI;

	var position = vec3(
		orbitmag*Math.cos(angle),
		orbitmag*Math.sin(angle),
		0
	);

	var size = vec3(radius, radius, radius);

	var mv = mult(hiermatrix, calc_modelview(
		position,
		size,
		vec3(0, 0, 0)
	));	

	// Render the actual planet
	gl.uniformMatrix4fv(uniforms.modelview, gl.FALSE, flatten(mv));

	gl.uniform3fv(uniforms.color, planet.color);

	gl.bindBuffer(gl.ARRAY_BUFFER, sphere.vbo);
	gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, gl.FALSE, 0, 0);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, sphere.nvertices);

	// Render the planet's orbit
	if(controls.orbiton.checked && planet.orbit) {
		var mv = mult(hiermatrix, scalem(orbitmag, orbitmag, orbitmag));

		gl.uniformMatrix4fv(uniforms.modelview, gl.FALSE, flatten(mv));

		gl.uniform3fv(uniforms.color, orbitcolor);

		gl.bindBuffer(gl.ARRAY_BUFFER, orbit.vbo);
		gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, gl.FALSE, 0, 0);

		gl.drawArrays(gl.LINE_STRIP, 0, orbit.nvertices);
	}

	// Render anything orbiting the planet
	if(planet.children) {
		var subhier = mult(hiermatrix,
			translate(position[0], position[1], position[2]));

		planet.children.forEach(function(p) {
			render_planet(p, subhier, day, level + 1);
		});
	}
}

function render(now) {
	// Timing
	if(!prevnow || now - prevnow > 1000)
		prevnow = now;

	if(controls.animon.checked)
		currentday += (now - prevnow)/1000*dayspersecond;

	// Get ready
	gl.clear(gl.COLOR_BUFFER_BIT);

	// Render
	gl.uniformMatrix4fv(uniforms.projection, gl.FALSE,
		flatten(calc_projection(-170e6, 170e6, -170e6, 170e6, 170e6, -170e6, orreytilt)));

	planets.forEach(function(p) {
		render_planet(p, mat4(), currentday, 0);
	});

	// Display the current day
	if(controls.dayon.checked)
		controls.day.textContent = 'Day ' + Math.round(currentday);
	else controls.day.textContent = '';

	// Get ready for the next frame
	prevnow = now;
	window.requestAnimationFrame(render);
}

