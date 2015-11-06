// Global state
var gl;
var attribs;
var uniforms;

var controls;

var basicprogram;
var splineprogram;

var points;
var interp;

var pointsize;

window.onload = function() {
	// Configuration
	pointsize = 10;

	// Set up WebGL
	var canvas = document.getElementById('canvas');
	gl = WebGLUtils.setupWebGL(canvas);
	if(!gl) alert('WebGL unavailable');

	gl.clearColor(0.9, 0.9, 0.9, 1);

	// Construct the shading program
	basicprogram = initShaders(gl, "basic.v.glsl", "basic.f.glsl");
	splineprogram = initShaders(gl, "spline.v.glsl", "spline.f.glsl");

	attribs = {
		basic: {
			position: find_attribute(basicprogram, 'a_position')
		},
		spline: {
			interp: find_attribute(splineprogram, 'a_interp')
		}
	};

	uniforms = {
		basic: {
			pointsize: find_uniform(basicprogram, 'u_pointsize'),
			color: find_uniform(basicprogram, 'u_color')
		},
		spline: {
			points0: find_uniform(splineprogram, 'u_points[0]'),
			points1: find_uniform(splineprogram, 'u_points[1]'),
			points2: find_uniform(splineprogram, 'u_points[2]'),
			points3: find_uniform(splineprogram, 'u_points[3]'),
			color: find_uniform(splineprogram, 'u_color')
		}
	};

	// Initialize data
	points = [];
	points.buffer = gl.createBuffer();

	var ninterp = 15;
	interp = [];
	for(var i = 0; i < ninterp; i++)
		interp.push(i/(ninterp - 1));
	interp.buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, interp.buffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(interp), gl.STATIC_DRAW);

	render();

	// Connect with the controls
	controls = {
		addvertex: document.getElementById('addvertex'),
		dragvertex: document.getElementById('dragvertex')
	};

	canvas.onclick = function(e) {
		if(!controls.addvertex.checked)
			return;

		points.push(calc_position(e));

		gl.bindBuffer(gl.ARRAY_BUFFER, points.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

		render();
	};

	var activepoint = null;

	canvas.onmousedown = function(e) {
		if(!controls.dragvertex.checked)
			return;

		var mousepoint = calc_position(e);

		points.forEach(function(point, i) {
			if(Math.abs(mousepoint[0] - point[0])*canvas.width < pointsize
				&& Math.abs(mousepoint[1] - point[1])*canvas.height < pointsize)
				activepoint = i;
		});
	};

	canvas.onmousemove = function(e) {
		if(activepoint === null)
			return;

		points[activepoint] = calc_position(e);

		gl.bindBuffer(gl.ARRAY_BUFFER, points.buffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 4*2*activepoint, flatten(points[activepoint]));

		render();
	};

	canvas.onmouseup = function() {
		activepoint = null;
	};
};

function calc_position(e) {
	var rect = e.target.getBoundingClientRect();
	return vec2(2*(e.clientX - rect.left)/e.target.width - 1,
		1 - 2*(e.clientY - rect.top)/e.target.height);

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
		console.warn('cannot find attribute ' + name);

	return loc;
}

function render() {
	gl.clear(gl.COLOR_BUFFER_BIT);

	// Draw the B-spline
	gl.useProgram(splineprogram)

	gl.bindBuffer(gl.ARRAY_BUFFER, interp.buffer);
	gl.enableVertexAttribArray(attribs.spline.interp);
	gl.vertexAttribPointer(attribs.spline.interp, 1, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform3f(uniforms.spline.color, 0.7, 0.1, 0.1);

	for(var i = 0; i < points.length - 1; i++) {
		gl.uniform2fv(uniforms.spline.points0, points[Math.max(0, i - 1)]);
		gl.uniform2fv(uniforms.spline.points1, points[i + 0]);
		gl.uniform2fv(uniforms.spline.points2, points[i + 1]);
		gl.uniform2fv(uniforms.spline.points3, points[Math.min(i + 2, points.length - 1)]);

		gl.drawArrays(gl.LINE_STRIP, 0, interp.length);
	}

	// Draw control points and lines
	gl.useProgram(basicprogram);

	gl.bindBuffer(gl.ARRAY_BUFFER, points.buffer);
	gl.enableVertexAttribArray(attribs.basic.position);
	gl.vertexAttribPointer(attribs.basic.position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform1f(uniforms.basic.pointsize, pointsize);

	gl.uniform3f(uniforms.basic.color, 0.7, 0.7, 0.7);

	gl.drawArrays(gl.LINE_STRIP, 0, points.length);

	gl.uniform3f(uniforms.basic.color, 0, 0, 0);

	gl.drawArrays(gl.POINTS, 0, points.length);
}

