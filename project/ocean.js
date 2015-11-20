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

// Geometry
var dome;
var quad;
var water;

var cells;

// Configuration
var choppiness; // Scaling factor for displacement vector
var cloudiness; // Cloud noise threshold
var daytime; // Time of day (for Sun position)
var foaminess; // Cresting texture threshold
var hdrscale; // Raw pixel scaling factor before x/(1 + x) compression
var horizon; // Maximum distance of water cells
var lodbias; // Limit factor of cell division
var skyres; // Resolution of the skymap
var turbidity; // Atomospheric haze
var waterdim; // Maximum resolution of a single water cell
var wavesamplitude; // Height of waves
var wavesdim; // Resolution of wave heightmap
var wavesscale; // World-space size of heightmap
var wind; // Wind vector
var wireframe; // Lines (instead of triangles?)

var latitude; // Location on Earth
var longitude;
var calendarday; // Day of the year, 1-365
var stdmeridian; // Standard meridian of the time zone

var playing;

var prevtime;
var frames;

window.onload = function() {
	hdrscale = 0.2;
	horizon = 1000;
	lodbias = 1;
	skyres = 32;
	waterdim = 8;

	latitude = 0;
	longitude = 0;
	calendarday = 1;
	stdmeridian = 0;

	camera = {
		xyz: vec3(0, 10, 0),
		rot: vec3(0, 0, 0)
	};

	// Hook up the controls
	document.getElementById('play').onclick = function() {
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
	document.getElementById('daytime').dispatchEvent(new Event('input'));

	document.getElementById('wavesamplitude').oninput = function() {
		wavesamplitude = Number(this.value);
		document.getElementById('wavesamplitudedisplay').textContent = this.value;
	};
	document.getElementById('wavesamplitude').dispatchEvent(new Event('input'));

	document.getElementById('wavesscale').oninput = function() {
		wavesscale = Number(this.value);
		document.getElementById('wavesscaledisplay').textContent = this.value;
	};
	document.getElementById('wavesscale').dispatchEvent(new Event('input'));

	document.getElementById('foaminess').oninput = function() {
		foaminess = Number(this.value);
		document.getElementById('foaminessdisplay').textContent = this.value;
	};
	document.getElementById('foaminess').dispatchEvent(new Event('input'));

	document.getElementById('choppiness').oninput = function() {
		choppiness = Number(this.value);
		document.getElementById('choppinessdisplay').textContent = this.value;
	};
	document.getElementById('choppiness').dispatchEvent(new Event('input'));

	document.getElementById('windx').oninput = function() {
		wind = wind || vec2(0, 0);
		wind[0] = Number(this.value);
		document.getElementById('windxdisplay').textContent = this.value;
	};
	document.getElementById('windx').dispatchEvent(new Event('input'));

	document.getElementById('windy').oninput = function() {
		wind = wind || vec2(0, 0);
		wind[1] = Number(this.value);
		document.getElementById('windydisplay').textContent = this.value;
	};
	document.getElementById('windy').dispatchEvent(new Event('input'));

	document.getElementById('turbidity').oninput = function() {
		turbidity = Number(this.value);
		document.getElementById('turbiditydisplay').textContent = this.value;
	};
	document.getElementById('turbidity').dispatchEvent(new Event('input'));

	document.getElementById('cloudiness').oninput = function() {
		cloudiness = Number(this.value);
		document.getElementById('cloudinessdisplay').textContent = this.value;
	};
	document.getElementById('cloudiness').dispatchEvent(new Event('input'));

	document.getElementById('anisotropy').oninput = function() {
		var anisotropy = 1 << this.value;

		gl.bindTexture(gl.TEXTURE_2D, textures.waves[0]);
		gl.texParameteri(gl.TEXTURE_2D, glaniso.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);

		gl.bindTexture(gl.TEXTURE_2D, textures.waves[1]);
		gl.texParameteri(gl.TEXTURE_2D, glaniso.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);

		gl.bindTexture(gl.TEXTURE_2D, null);

		document.getElementById('anisotropydisplay').textContent = anisotropy;
	};

	document.getElementById('wireframe').onchange = function() {
		wireframe = this.checked;
	};
	document.getElementById('wireframe').dispatchEvent(new Event('change'));

	document.getElementById('wavesdim').onchange = function() {
		wavesdim = Number(this.value);
		if(textures)
			resize_wave_textures();
	};
	document.getElementById('wavesdim').dispatchEvent(new Event('change'));

	canvas = document.getElementById('canvas');
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

		e.stopPropagation();
	};

	// Set up WebGL
	gl = WebGLUtils.setupWebGL(canvas);
	if(!gl) alert('WebGL unavailable');

	glaniso = gl.getExtension('EXT_texture_filter_anisotropic');
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
		dome: build_program('dome.v.glsl', 'dome.f.glsl'),
		fft: build_program('fft.v.glsl', 'fft.f.glsl'),
		fft_final: build_program('fft_final.v.glsl', 'fft_final.f.glsl'),
		sky: build_program('sky.v.glsl', 'sky.f.glsl'),
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

	textures.waves = [
			gl.createTexture(),
			gl.createTexture()
	];

	gl.bindTexture(gl.TEXTURE_2D, textures.waves[0]);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, wavesdim, wavesdim, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

	gl.bindTexture(gl.TEXTURE_2D, textures.waves[1]);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, wavesdim, wavesdim, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

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

	fbos = {};

	fbos.spectrum_height = gen_fbo(gl.TEXTURE_2D, textures.spectrum_height);
	fbos.spectrum_slope = gen_fbo(gl.TEXTURE_2D, textures.spectrum_slope);
	fbos.spectrum_disp = gen_fbo(gl.TEXTURE_2D, textures.spectrum_disp);

	fbos.fft_height = [
		gen_fbo(gl.TEXTURE_2D, textures.fft_height[0]),
		gen_fbo(gl.TEXTURE_2D, textures.fft_height[1])
	];

	fbos.fft_slope = [
		gen_fbo(gl.TEXTURE_2D, textures.fft_slope[0]),
		gen_fbo(gl.TEXTURE_2D, textures.fft_slope[1])
	];

	fbos.fft_disp = [
		gen_fbo(gl.TEXTURE_2D, textures.fft_disp[0]),
		gen_fbo(gl.TEXTURE_2D, textures.fft_disp[1])
	];

	fbos.waves = [
		gen_fbo(gl.TEXTURE_2D, textures.waves[0]),
		gen_fbo(gl.TEXTURE_2D, textures.waves[1])
	];

	fbos.sky = [
		gen_fbo(gl.TEXTURE_CUBE_MAP_POSITIVE_X, textures.sky),
		gen_fbo(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, textures.sky),
		gen_fbo(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, textures.sky),
		gen_fbo(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, textures.sky),
		gen_fbo(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, textures.sky)
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
		document.getElementById('anisotropy').max = Math.round(
			Math.log(gl.getParameter(glaniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))/Math.log(2));
		document.getElementById('anisotropy').dispatchEvent(new Event('input'));
	}

	playing = false;
	frames = 0;

	window.requestAnimationFrame(render);
};

// Compile shaders and perform introspection to automatically list the attributes and uniforms
function build_program(vshader, fshader) {
	var array = /(.*)\[\d*\]/;

	var program = initShaders(gl, vshader, fshader);

	var nuniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
	var nattribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

	for(var ui = 0; ui < nuniforms; ui++) {
		var info = gl.getActiveUniform(program, ui);

		if(info.size > 1) {
			var parts = info.name.match(array);

			program[parts[1]] = [];
			for(var i = 0; i < info.size; i++)
				program[parts[1]].push(
					gl.getUniformLocation(program, parts[1] + '[' + i + ']')
				);
		} else program[info.name] = gl.getUniformLocation(program, info.name);
	}

	for(var ai = 0; ai < nattribs; ai++) {
		var info = gl.getActiveAttrib(program, ai);
		program[info.name] = gl.getAttribLocation(program, info.name)
	}

	return program;
}

// Calculates the position of the Sun in the sky, based on the time of day
function calc_sun_position() {
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

	return {dir: dir, theta: theta, phi: phi};
}

// Creates a framebuffer and attaches a texture to it
function gen_fbo(c0type, c0tex) {
	var fbo = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, c0type, c0tex, 0);

	if(gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
		alert('FATAL: incomplete framebuffer');
		console.trace();
	}

	return fbo;
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

// Updates the wave textures with the current wavesdim
function resize_wave_textures() {
	[
		textures.spectrum_height,
		textures.spectrum_slope,
		textures.spectrum_disp,
		textures.fft_height[0],
		textures.fft_height[1],
		textures.fft_slope[0],
		textures.fft_slope[1],
		textures.fft_disp[0],
		textures.fft_disp[1],
		textures.waves[0],
		textures.waves[1]
	].forEach(function(tex) {
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, wavesdim, wavesdim, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	});

	[
		textures.waves[0],
		textures.waves[1]
	].forEach(function(tex) {
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.generateMipmap(gl.TEXTURE_2D);
	});

	gl.bindTexture(gl.TEXTURE_2D, null);
}

// Update the wave spectrum texture
function render_spectrum(time) {
	gl.viewport(0, 0, wavesdim, wavesdim);

	gl.useProgram(programs.spectrum);

	gl.disable(gl.DEPTH_TEST);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.spectrum.a_position);
	gl.vertexAttribPointer(programs.spectrum.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform2f(programs.spectrum.u_dim, wavesdim, wavesdim);
	gl.uniform2fv(programs.spectrum.u_wind, wind);
	gl.uniform1f(programs.spectrum.u_amplitude, wavesamplitude);
	gl.uniform1f(programs.spectrum.u_scale, wavesscale);
	gl.uniform2f(programs.spectrum.u_seed, 8, 8);

	gl.uniform1f(programs.spectrum.u_time, time);

	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.spectrum_height);
	gl.uniform1i(programs.spectrum.u_output, 0);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.spectrum_slope);
	gl.uniform1i(programs.spectrum.u_output, 1);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.spectrum_disp);
	gl.uniform1i(programs.spectrum.u_output, 2);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);
}

// Update the wave height, slope, and displacement maps
function render_wave_maps() {
	// Rendering to wave FBO

	gl.viewport(0, 0, wavesdim, wavesdim);

	gl.disable(gl.DEPTH_TEST);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.fft_height[0]);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, textures.fft_height[1]);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, textures.fft_slope[0]);
	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, textures.fft_slope[1]);

	gl.activeTexture(gl.TEXTURE4);
	gl.bindTexture(gl.TEXTURE_2D, textures.fft_disp[0]);
	gl.activeTexture(gl.TEXTURE5);
	gl.bindTexture(gl.TEXTURE_2D, textures.fft_disp[1]);

	var niter = Math.round(Math.log(wavesdim)/Math.log(2));

	// Horizontal FFT
	gl.useProgram(programs.fft);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.fft.a_position);
	gl.vertexAttribPointer(programs.fft.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform1i(programs.fft.u_horizontal, 1);

	for(var i = 0; i < niter; i++) {
		var texin = i&1;

		gl.uniform2f(programs.fft.u_dim, wavesdim, wavesdim);
		gl.uniform1f(programs.fft.u_stage, i);

		gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.fft_height[texin^1]);
		gl.uniform1i(programs.fft.u_in, 0 + texin);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

		gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.fft_slope[texin^1]);
		gl.uniform1i(programs.fft.u_in, 2 + texin);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

		gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.fft_disp[texin^1]);
		gl.uniform1i(programs.fft.u_in, 4 + texin);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);
	}

	// Vertical FFT

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.fft.a_position);
	gl.vertexAttribPointer(programs.fft.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform1i(programs.fft.u_horizontal, 0);

	for(var i = 0; i < niter; i++) {
		var texin = (niter + i)&1;

		gl.uniform2f(programs.fft.u_dim, wavesdim, wavesdim);
		gl.uniform1f(programs.fft.u_stage, i);

		gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.fft_height[texin^1]);
		gl.uniform1i(programs.fft.u_in, 0 + texin);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

		gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.fft_slope[texin^1]);
		gl.uniform1i(programs.fft.u_in, 2 + texin);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

		gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.fft_disp[texin^1]);
		gl.uniform1i(programs.fft.u_in, 4 + texin);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);
	}

	// Finalize FFT (sign change)
	gl.useProgram(programs.fft_final);

	gl.disable(gl.DEPTH_TEST);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.fft_final.a_position);
	gl.vertexAttribPointer(programs.fft_final.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform1i(programs.fft_final.u_in[0], 0);
	gl.uniform1i(programs.fft_final.u_in[1], 2);
	gl.uniform1i(programs.fft_final.u_in[2], 4);
	gl.uniform2f(programs.fft_final.u_dim, wavesdim, wavesdim);

	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.waves[0]);
	gl.uniform1i(programs.fft_final.u_output, 0);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.waves[1]);
	gl.uniform1i(programs.fft_final.u_output, 1);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	// Generate the wave mipmaps
	gl.bindTexture(gl.TEXTURE_2D, textures.waves[0]);
	gl.generateMipmap(gl.TEXTURE_2D);

	gl.bindTexture(gl.TEXTURE_2D, textures.waves[1]);
	gl.generateMipmap(gl.TEXTURE_2D);
}

// Update the atmosphere cube map (not including the Sun or the clouds for resolution reasons)
function render_sky_map(suninfo) {
	// Rendering to sky cubemap

	gl.viewport(0, 0, skyres, skyres);

	gl.useProgram(programs.sky);

	gl.disable(gl.DEPTH_TEST);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.sky.a_position);
	gl.vertexAttribPointer(programs.sky.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform3fv(programs.sky.u_sundir, suninfo.dir);
	gl.uniform1f(programs.sky.u_suntheta, suninfo.theta);
	gl.uniform1f(programs.sky.u_turbidity, turbidity);

	for(var i = 0; i < 5; i++) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.sky[i]);
		gl.uniform1i(programs.sky.u_face, i);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);
	}
}

// Actually output everything (atmosphere, waves, Sun, and clouds) to the canvas
function render_scene(suninfo, time) {
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Sky dome
	gl.useProgram(programs.dome);

	gl.disable(gl.DEPTH_TEST);

	var camrot = mat4();
	camrot = mult(rotateZ(-camera.rot[2]), camrot);
	camrot = mult(rotateY(-camera.rot[1]), camrot);
	camrot = mult(rotateX(-camera.rot[0]), camrot);
	camrot = mult(perspective(100, 1/1, 0.1, horizon), camrot);

	gl.bindBuffer(gl.ARRAY_BUFFER, dome.points.buffer);
	gl.enableVertexAttribArray(programs.dome.a_position);
	gl.vertexAttribPointer(programs.dome.a_position, 3, gl.FLOAT, gl.FALSE, 0, 0);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dome.indices.buffer);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures.sky);

	gl.uniform1i(programs.dome.u_sky, 0);

	gl.uniformMatrix4fv(programs.dome.u_camera, gl.FALSE, flatten(camrot));
	gl.uniform3fv(programs.dome.u_sundir, suninfo.dir);
	gl.uniform1f(programs.dome.u_suntheta, suninfo.theta);
	gl.uniform1f(programs.dome.u_time, time);
	gl.uniform1f(programs.dome.u_turbidity, turbidity);
	gl.uniform2fv(programs.dome.u_wind, wind);

	gl.uniform1f(programs.dome.u_cloudiness, cloudiness);
	gl.uniform1f(programs.dome.u_hdrscale, hdrscale);

	gl.drawElements(gl.TRIANGLE_STRIP, dome.indices.length, gl.UNSIGNED_BYTE, 0);

	// Water grid
	gl.useProgram(programs.water);

	gl.enable(gl.DEPTH_TEST);

	var cam = mat4();
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
	gl.bindTexture(gl.TEXTURE_2D, textures.waves[0]);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, textures.waves[1]);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures.sky);

	gl.uniform1i(programs.water.u_waves[0], 0);
	gl.uniform1i(programs.water.u_waves[1], 1);
	gl.uniform1i(programs.water.u_sky, 2);

	gl.uniformMatrix4fv(programs.water.u_camera, gl.FALSE, flatten(cam));

	gl.uniform3fv(programs.water.u_cameraxyz, camera.xyz);
	gl.uniform1f(programs.water.u_choppiness, choppiness);
	gl.uniform1f(programs.water.u_foaminess, foaminess);
	gl.uniform1f(programs.water.u_scale, wavesscale);

	gl.uniform3f(programs.water.u_color, 0, 0.2, 0.3);

	gl.uniform3fv(programs.water.u_sundir, suninfo.dir);
	gl.uniform1f(programs.water.u_suntheta, suninfo.theta);
	gl.uniform1f(programs.water.u_turbidity, turbidity);

	gl.uniform1f(programs.water.u_hdrscale, hdrscale);

	cells.forEach(function(cell) {
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
}

function render(now) {
	var nowsec = now/1000;

	// FPS counter
	if(!prevtime)
		prevtime = now;

	if(now - prevtime >= 1000) {
		prevtime += Math.floor((now - prevtime)/1000)*1000;
		console.log(frames);
		frames = 0;
	}
	frames++;

	// Update Sun
	var suninfo = calc_sun_position();

	// Do all the rendering
	render_spectrum(nowsec);
	render_wave_maps();
	render_sky_map(suninfo);
	render_scene(suninfo, nowsec);

	if(playing)
		window.requestAnimationFrame(render);
}

