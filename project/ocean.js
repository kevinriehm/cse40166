'use strict';

// Global state
var gl;
var glaniso;
var glhalf;
var glhalflinear;

var canvas;

var programs;

var fbos;
var textures;

var camera;
var wavesffts;

// Geometry
var dome;
var quad;
var water;

var cells;

// Configuration
var choppiness; // Scaling factor for displacement vector
var cloudiness; // Cloud noise threshold
var cloudres; // Resolution of cloud texture
var daytime; // Time of day (for Sun position)
var fov; // Vertical field of view in degrees
var hdrscale; // Raw pixel scaling factor before x/(1 + x) compression
var horizon; // Maximum distance of water cells
var lodbias; // Limit factor of cell division
var rippliness; // Ripple normal map intensity
var skyres; // Resolution of the skymap
var turbidity; // Atomospheric haze
var watercolor; // Base "ambient" color of water
var waterdim; // Maximum resolution of a single water cell
var wavesamplitude; // Height of waves
var wavesdim; // Resolution of wave heightmap
var wavesscale; // Base world-space size of heightmap
var wavesscalescale; // Progression of world-space sizes of heightmaps
var wind; // Wind vector
var wireframe; // Lines (instead of triangles?)

var latitude; // Location on Earth
var longitude;
var calendarday; // Day of the year, 1-365
var stdmeridian; // Standard meridian of the time zone

var renderscale; // Fraction of actual canvas size at which to render

var playing;
var pausetime;
var timeoffset;

var prevtime;
var frames;

window.onload = function() {
	cloudres = 1024;
	hdrscale = 0.2;
	horizon = 5000;
	lodbias = 1;
	skyres = 32;
	watercolor = vec3(0.3, 0.7, 1.4);
	waterdim = 8;
	wavesscalescale = Math.sqrt(13);

	latitude = 0;
	longitude = 0;
	calendarday = 1;
	stdmeridian = 0;

	camera = {
		xyz: vec3(0, 15, 0),
		rot: vec3(0, 0, 0)
	};

	wavesffts = [];

	// Hook up the controls
	canvas = document.getElementById('canvas');

	document.getElementById('play').onclick = function() {
		if(playing)
			pausetime = performance.now();
		else timeoffset += performance.now() - pausetime;

		playing = !playing;

		this.textContent = playing ? "Pause" : "Play";

		if(playing)
			window.requestAnimationFrame(render);
	};

	document.getElementById('daytime').oninput = function() {
		daytime = Number(this.value);
		var minstr = String(Math.floor(60*(daytime - Math.floor(daytime))));
		if(minstr.length === 1)
			minstr = '0' + minstr;
		document.getElementById('daytimedisplay').textContent
			= Math.floor(daytime) + ':' + minstr;
	};

	document.getElementById('wavesamplitude').oninput = function() {
		wavesamplitude = Number(this.value);
		document.getElementById('wavesamplitudedisplay').textContent = this.value;
	};

	document.getElementById('wavesscale').oninput = function() {
		wavesscale = Number(this.value);
		wavesffts.forEach(function(fft, i) {
			fft.set_scale(wavesscale*Math.pow(wavesscalescale, i));
		});
		document.getElementById('wavesscaledisplay').textContent = this.value;
	};

	document.getElementById('choppiness').oninput = function() {
		choppiness = Number(this.value);
		document.getElementById('choppinessdisplay').textContent = this.value;
	};

	document.getElementById('rippliness').oninput = function() {
		rippliness = Number(this.value);
		document.getElementById('ripplinessdisplay').textContent = this.value;
	};
	document.getElementById('rippliness').dispatchEvent(new Event('input'));

	document.getElementById('windx').oninput = function() {
		wind = wind || vec2(0, 0);
		wind[0] = Number(this.value);
		document.getElementById('windxdisplay').textContent = this.value;
	};

	document.getElementById('windy').oninput = function() {
		wind = wind || vec2(0, 0);
		wind[1] = Number(this.value);
		document.getElementById('windydisplay').textContent = this.value;
	};

	document.getElementById('turbidity').oninput = function() {
		turbidity = Number(this.value);
		document.getElementById('turbiditydisplay').textContent = this.value;
	};

	document.getElementById('cloudiness').oninput = function() {
		cloudiness = Number(this.value);
		document.getElementById('cloudinessdisplay').textContent = this.value;
	};

	document.getElementById('anisotropy').oninput = function() {
		if(!glaniso)
			return;

		var anisotropy = 1 << this.value;

		wavesffts.forEach(function(fft) {
			fft.set_anisotropy(anisotropy);
		});

		[
			textures.cloud,
			textures.ripples[0],
			textures.ripples[1]
		].forEach(function(tex) {
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texParameteri(gl.TEXTURE_2D, glaniso.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
		});

		document.getElementById('anisotropydisplay').textContent = anisotropy;
	};

	document.getElementById('fov').oninput = function() {
		fov = Number(this.value);
		document.getElementById('fovdisplay').textContent = this.value;
	};
	document.getElementById('fov').dispatchEvent(new Event('input'));

	document.getElementById('renderscale').oninput = function() {
		renderscale = Number(this.value);
		canvas.width = renderscale*canvas.clientWidth;
		canvas.height = renderscale*canvas.clientHeight;
		document.getElementById('renderscaledisplay').textContent = canvas.width + 'x' + canvas.height;
	};
	document.getElementById('renderscale').dispatchEvent(new Event('input'));

	document.getElementById('wireframe').onchange = function() {
		wireframe = this.checked;
	};
	document.getElementById('wireframe').dispatchEvent(new Event('change'));

	document.getElementById('wavesdim').onchange = function() {
		wavesdim = Number(this.value);
		wavesffts.forEach(function(fft) {
			fft.resize(wavesdim);
		});
	};
	document.getElementById('wavesdim').dispatchEvent(new Event('change'));

	document.getElementById('preset').onchange
		= document.getElementById('preset').onkeyup
		= function() {
			var settings = JSON.parse(this.value);

			for(var id in settings) {
				var element = document.getElementById(id);

				element.value = settings[id];

				if(element.oninput)
					element.dispatchEvent(new Event('input'));

				if(element.onchange)
					element.dispatchEvent(new Event('change'));
			}
		};
	document.getElementById('preset').dispatchEvent(new Event('change'));

	window.onresize = function() {
		document.getElementById('renderscale').dispatchEvent(new Event('input'));
	};

	canvas.onmousedown = function(e) {
		if(!playing)
			return;

		canvas.draglast = vec2(e.clientX, e.clientY);
	};

	canvas.onmousemove = function(e) {
		if(!canvas.draglast)
			return;

		var dragnow = vec2(e.clientX, e.clientY);

		camera.rot[0] += 100*(dragnow[1] - canvas.draglast[1])/canvas.width;
		camera.rot[1] += 100*(dragnow[0] - canvas.draglast[0])/canvas.height;

		// Reasonable range clamping
		camera.rot[0] = Math.max(-90, Math.min(camera.rot[0], 90));

		canvas.draglast = dragnow;
	};

	document.onmouseup = function(e) {
		delete canvas.draglast;
	};

	// Set up WebGL
	gl = WebGLUtils.setupWebGL(canvas);
	if(!gl) alert('WebGL unavailable');

	glaniso = gl.getExtension('EXT_texture_filter_anisotropic')
		|| gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
	glhalf = gl.getExtension('OES_texture_half_float');
	glhalflinear = gl.getExtension('OES_texture_half_float_linear');

	if(!glhalf)
		alert('FATAL: OES_texture_half_float is required but not supported');
	if(!glhalflinear)
		alert('FATAL: OES_texture_half_float_linear is required but not supported');

	if(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 2)
		alert('FATAL: MAX_VERTEX_TEXTURE_IMAGE_UNITS must be at least 2');

	gl.clearColor(0, 0, 0, 1);

	// Compile shaders
	programs = {
		cloud: build_program('cloud.v.glsl', 'cloud.f.glsl'),
		dome: build_program('dome.v.glsl', 'dome.f.glsl'),
		fft: build_program('fft.v.glsl', 'fft.f.glsl'),
		fft_final: build_program('fft_final.v.glsl', 'fft_final.f.glsl'),
		fft_transpose: build_program('fft_transpose.v.glsl', 'fft_transpose.f.glsl'),
		sky: build_program('sky.v.glsl', 'sky.f.glsl'),
		spectrum: build_program('spectrum.v.glsl', 'spectrum.f.glsl'),
		water: build_program('water.v.glsl', 'water.f.glsl')
	};

	// Set up render targets
	wavesffts.push(new WavesFFT(wavesdim, wavesscale));
	wavesffts.push(new WavesFFT(wavesdim, wavesscale*wavesscalescale));

	textures = {};

	textures.cloud = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, textures.cloud);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cloudres, cloudres, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.generateMipmap(gl.TEXTURE_2D);

	textures.sky = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures.sky);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, skyres, skyres, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, skyres, skyres, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, skyres, skyres, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, skyres, skyres, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, skyres, skyres, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, skyres, skyres, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	textures.ripples = [
		load_image('ripples0.png'),
		load_image('ripples1.png')
	];

	fbos = {};

	fbos.cloud = gen_fbo(gl.TEXTURE_2D, textures.cloud);

	fbos.sky = [
		gen_fbo(gl.TEXTURE_CUBE_MAP_POSITIVE_X, textures.sky),
		gen_fbo(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, textures.sky),
		gen_fbo(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, textures.sky),
		gen_fbo(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, textures.sky),
		gen_fbo(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, textures.sky),

		// Never used, but there for completeness
		gen_fbo(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, textures.sky)
	];

	// Set up geometry
	dome = {
		points: [
			vec3( 0,  1,  0),
			vec3( 0,  0,  1),
			vec3(-1,  0, -1),
			vec3( 1,  0, -1),
			vec3( 0, -1,  0)
		],
		indices: [1, 3, 0, 2, 1, 4, 3, 2]
	};

	dome.points.buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, dome.points.buffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(dome.points), gl.STATIC_DRAW);

	dome.indices.buffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dome.indices.buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(dome.indices), gl.STATIC_DRAW);

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

	// Finalize configuration and go
	if(glaniso) {
		document.getElementById('anisotropy').value
			= document.getElementById('anisotropy').max
			= Math.round(Math.log(gl.getParameter(
				glaniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))/Math.log(2));
		document.getElementById('anisotropy').dispatchEvent(new Event('input'));
	}

	render_cloud_map();

	playing = false;
	frames = 0;

	window.requestAnimationFrame(render);
};

// Calculates the position and color of the Sun in the sky, based on the time of day
function calc_sun() {
	// Sun position
	var declination = 0.4093*Math.sin(2*Math.PI,(calendarday - 81)/368);
	var suntime = daytime + 0.170*Math.sin(4*Math.PI*(calendarday - 80)/373)
		- 0.129*Math.sin(2*Math.PI*(calendarday - 8)/355)
		+ 12*(stdmeridian - longitude)/Math.PI;

	var theta = Math.PI/2 - Math.asin(Math.sin(latitude)*Math.sin(declination)
		- Math.cos(latitude)*Math.cos(declination)*Math.cos(Math.PI*suntime/12));
	var phi = Math.atan(-Math.cos(declination)*Math.sin(Math.PI*suntime/12)
		/(Math.cos(latitude)*Math.sin(declination)
			- Math.sin(latitude)*Math.cos(declination)*Math.cos(Math.PI*suntime/12)));

	var dir = vec3(Math.cos(phi), Math.cos(theta), -Math.sin(theta)*Math.sin(phi));

	// Sunlight
	var basecolor = vec3(2024.04, 2550.38, 3005.75);
	var lambda = vec3(0.700, 0.550, 0.450);
	var k_o = vec3(0.023, 0.085, 0.009);
	var k_w = vec3(0.024, 0, 0);

	var b = 0.04608*turbidity - 0.04586;
	var m = 1/(Math.cos(0.6*theta) + 0.15*Math.pow(93.885 - 0.6*theta/Math.PI*180, -1.253));

	function pow(v, e) {
		return v.map(function(x) { return Math.pow(x, e); });
	}

	var t0 = scale(-0.008735, pow(lambda, -4.08*m));
	var t1 = scale(-b, pow(lambda, -1.3*m));
	var t2 = scale(-0.35*m, k_o);
	var t3 = mult(scale(-0.4770*m, k_w), pow(add(vec3(1, 1, 1), scale(40.14*m, k_w)), -0.45));
	var t = add(add(t0, t1), add(t2, t3)).map(Math.exp);

	var color = mult(t, basecolor);

	return {dir: dir, theta: theta, phi: phi, color: color};
}

// Update the cloud texture
function render_cloud_map() {
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.cloud);
	gl.viewport(0, 0, cloudres, cloudres);

	gl.useProgram(programs.cloud);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.spectrum.a_position);
	gl.vertexAttribPointer(programs.spectrum.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	gl.bindTexture(gl.TEXTURE_2D, textures.cloud);
	gl.generateMipmap(gl.TEXTURE_2D);
}

// Update the wave spectrum textures
function render_spectrums(time) {
	wavesffts.forEach(function(fft) {
		fft.render_spectrum(time);
	});
}

// Update the wave height, slope, and displacement maps
function render_wave_maps() {
	wavesffts.forEach(function(fft) {
		fft.render_wave_maps();
	});
}

// Update the atmosphere cube map (not including the Sun or the clouds for resolution reasons)
function render_sky_map(suninfo) {
	gl.viewport(0, 0, skyres, skyres);

	gl.useProgram(programs.sky);

	gl.disable(gl.DEPTH_TEST);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.sky.a_position);
	gl.vertexAttribPointer(programs.sky.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform3fv(programs.sky.u_sundir, suninfo.dir);
	gl.uniform1f(programs.sky.u_suntheta, suninfo.theta/1.05);
	gl.uniform1f(programs.sky.u_turbidity, turbidity);

	for(var i = 0; i < 5; i++) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.sky[i]);
		gl.uniform1i(programs.sky.u_face, i);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);
	}
}
var lookdir;
// Actually output everything (atmosphere, waves, Sun, and clouds) to the canvas
function render_scene(suninfo, time) {
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Water grid
	gl.useProgram(programs.water);

	gl.enable(gl.CULL_FACE);
	gl.enable(gl.DEPTH_TEST);

	gl.depthMask(true);

	var cam = mat4();
	cam = mult(translate(-camera.xyz[0], -camera.xyz[1], -camera.xyz[2]), cam);
	cam = mult(rotateZ(-camera.rot[2]), cam);
	cam = mult(rotateY(-camera.rot[1]), cam);
	cam = mult(rotateX(-camera.rot[0]), cam);
	cam = mult(perspective(fov, canvas.clientWidth/canvas.clientHeight, 0.1, horizon), cam);

	var invrot = mat4();
	invrot = mult(rotateX(camera.rot[0]), invrot);
	invrot = mult(rotateY(camera.rot[1]), invrot);
	invrot = mult(rotateZ(camera.rot[2]), invrot);

	lookdir = vec4(0, 0, -1, 0);
	lookdir = vec3(
		dot(invrot[0], lookdir),
		dot(invrot[1], lookdir),
		dot(invrot[2], lookdir)
	);

	gl.bindBuffer(gl.ARRAY_BUFFER, water.points.buffer);
	gl.enableVertexAttribArray(programs.water.a_position);
	gl.vertexAttribPointer(programs.water.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, water.indices.buffer);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, wavesffts[0].textures.waves[0]);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, wavesffts[0].textures.waves[1]);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, wavesffts[1].textures.waves[0]);

	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, wavesffts[1].textures.waves[1]);

	gl.activeTexture(gl.TEXTURE4);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures.sky);

	gl.activeTexture(gl.TEXTURE5);
	gl.bindTexture(gl.TEXTURE_2D, textures.cloud);

	gl.activeTexture(gl.TEXTURE6);
	gl.bindTexture(gl.TEXTURE_2D, textures.ripples[0]);

	gl.activeTexture(gl.TEXTURE7);
	gl.bindTexture(gl.TEXTURE_2D, textures.ripples[1]);

	gl.uniform1i(programs.water.u_waves0[0], 0);
	gl.uniform1i(programs.water.u_waves0[1], 1);
	gl.uniform1i(programs.water.u_waves1[0], 0);
	gl.uniform1i(programs.water.u_waves1[1], 1);
	gl.uniform1i(programs.water.u_sky, 4);
	gl.uniform1i(programs.water.u_cloud, 5);
	gl.uniform1i(programs.water.u_ripples[0], 6);
	gl.uniform1i(programs.water.u_ripples[1], 7);

	gl.uniformMatrix4fv(programs.water.u_camera, gl.FALSE, flatten(cam));

	gl.uniform3fv(programs.water.u_cameraxyz, camera.xyz);
	gl.uniform1f(programs.water.u_choppiness, choppiness);
	gl.uniform1f(programs.water.u_rippliness, rippliness);
	gl.uniform1f(programs.water.u_scale[0], wavesscale);
	gl.uniform1f(programs.water.u_scale[1], wavesscale*wavesscalescale);

	gl.uniform3fv(programs.water.u_color, watercolor);

	gl.uniform3fv(programs.water.u_sundir, suninfo.dir);
	gl.uniform3fv(programs.water.u_sunlight, suninfo.color);
	gl.uniform1f(programs.water.u_suntheta, suninfo.theta);
	gl.uniform1f(programs.water.u_turbidity, turbidity);

	gl.uniform1f(programs.water.u_hdrscale, hdrscale);

	gl.uniform1f(programs.water.u_time, time);
	gl.uniform2fv(programs.water.u_wind, wind);
	gl.uniform1f(programs.water.u_cloudiness, cloudiness);

	cells.forEach(function(cell) {
		var center = vec3(cell.x + cell.w/2, 0, cell.z + cell.h/2);

		if(dot(lookdir, normalize(subtract(center, camera.xyz))) < 0)
			return;

		gl.uniformMatrix4fv(programs.water.u_modelview, gl.FALSE, flatten(cell.mv));

		gl.uniform1fv(programs.water.u_edgesize[0], [
			(1 << cell.seams.w)/waterdim,
			(1 << cell.seams.e)/waterdim,
			(1 << cell.seams.s)/waterdim,
			(1 << cell.seams.n)/waterdim
		]);

		gl.drawElements(wireframe ? gl.LINE_STRIP : gl.TRIANGLE_STRIP,
			water.indices.length, gl.UNSIGNED_SHORT, 0);
	});

	// Sky dome
	gl.useProgram(programs.dome);

	gl.disable(gl.CULL_FACE);

	gl.depthMask(false);

	var camrot = mat4();
	camrot = mult(rotateZ(-camera.rot[2]), camrot);
	camrot = mult(rotateY(-camera.rot[1]), camrot);
	camrot = mult(rotateX(-camera.rot[0]), camrot);
	camrot = mult(perspective(fov, canvas.clientWidth/canvas.clientHeight, 0.1, 2*horizon), camrot);

	gl.bindBuffer(gl.ARRAY_BUFFER, dome.points.buffer);
	gl.enableVertexAttribArray(programs.dome.a_position);
	gl.vertexAttribPointer(programs.dome.a_position, 3, gl.FLOAT, gl.FALSE, 0, 0);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dome.indices.buffer);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures.sky);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, textures.cloud);

	gl.uniform1i(programs.dome.u_sky, 0);
	gl.uniform1i(programs.dome.u_cloud, 1);

	gl.uniformMatrix4fv(programs.dome.u_camera, gl.FALSE, flatten(camrot));

	gl.uniform1f(programs.dome.u_horizon, horizon);

	gl.uniform3fv(programs.dome.u_sundir, suninfo.dir);
	gl.uniform3fv(programs.dome.u_sunlight, suninfo.color);
	gl.uniform1f(programs.dome.u_suntheta, suninfo.theta);
	gl.uniform1f(programs.dome.u_time, time);
	gl.uniform1f(programs.dome.u_turbidity, turbidity);
	gl.uniform2fv(programs.dome.u_wind, wind);

	gl.uniform1f(programs.dome.u_cloudiness, cloudiness);
	gl.uniform1f(programs.dome.u_hdrscale, hdrscale);

	gl.drawElements(gl.TRIANGLE_STRIP, dome.indices.length, gl.UNSIGNED_BYTE, 0);
}

function render(now) {
	if(!pausetime)
		pausetime = now;

	if(!timeoffset)
		timeoffset = now;

	now -= timeoffset;
	var nowsec = now/1000;

	// FPS counter
	if(!prevtime)
		prevtime = now;

	if(now - prevtime >= 1000) {
		prevtime += Math.floor((now - prevtime)/1000)*1000;
		document.getElementById('fpsdisplay').textContent = frames;
		frames = 0;
	}
	frames++;

	// Update Sun
	var suninfo = calc_sun();

	// Do all the rendering
	render_spectrums(nowsec);
	render_wave_maps();
	render_sky_map(suninfo);
	render_scene(suninfo, nowsec);

	if(playing)
		window.requestAnimationFrame(render);
}

