var gl;
var vertices;
var offsetW;

window.onload = function init() {
	var canvas = document.getElementById("gl-canvas");

	gl = WebGLUtils.setupWebGL(canvas);
	if(!gl) alert("WebGL isn't available");

	vertices = [];

	// 'K' (triangles)
	vertices.push(
		vec2(-0.7,  0.8),
		vec2(-0.7, -0.8),
		vec2(-0.6, -0.8),

		vec2(-0.6, -0.8),
		vec2(-0.6,  0.8),
		vec2(-0.7,  0.8),

		vec2(-0.1,  0.8),
		vec2(-0.2,  0.8),
		vec2(-0.6,  0.1),

		vec2(-0.6,  0.1),
		vec2(-0.6, -0.1),
		vec2(-0.1,  0.8),

		vec2(-0.1, -0.8),
		vec2(-0.5,  0.1),
		vec2(-0.6,  0.1),

		vec2(-0.6,  0.1),
		vec2(-0.2, -0.8),
		vec2(-0.1, -0.8)
	);


	// 'R' (triangle strip)
	offsetW = vertices.length;
	vertices.push(
		vec2( 0.1, -0.8),
		vec2( 0.2, -0.8),
		vec2( 0.1,  0.8),
		vec2( 0.2,  0.7),
		vec2( 0.2,  0.8),
		vec2( 0.3,  0.7)
	);

	[].push.apply(vertices,(function() {
		var points = [];
		var npoints = 99;

		for(var i = 0; i <= npoints; i++) {
			var rx = i&1 ? 0.3 : 0.4;
			var ry = i&1 ? 0.35 : 0.45;
			var angle = Math.PI/2 - i/npoints*Math.PI;
			points.push(vec2(0.3 + rx*Math.cos(angle), 0.35 + ry*Math.sin(angle)));
		}

		return points;
	})());

	vertices.push(
		vec2( 0.3, -0.1),
		vec2( 0.2,  0.0),
		vec2( 0.7, -0.8),
		vec2( 0.2, -0.1),
		vec2( 0.6, -0.8)
	);

	//  Configure WebGL

	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clearColor(0.8, 0.8, 0.8, 1.0);

	//  Load shaders and initialize attribute buffers
	var program = initShaders(gl, "vertex-shader", "fragment-shader");
	gl.useProgram(program);

	// Load the data into the GPU
	var bufferId = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

	// Associate out shader variables with our data buffer
	var vPosition = gl.getAttribLocation(program, "vPosition");
	gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(vPosition);

	baseColorLoc = gl.getUniformLocation(program, "baseColor");

	render();
};

function render() {
	gl.clear( gl.COLOR_BUFFER_BIT );

	gl.uniform3fv(baseColorLoc, vec3(1.0, 0.6, 0.2));
	gl.drawArrays(gl.TRIANGLES, 0, offsetW);

	gl.uniform3fv(baseColorLoc, vec3(0.7, 0.0, 0.7));
	gl.drawArrays(gl.TRIANGLE_STRIP, offsetW, vertices.length - offsetW);
}

