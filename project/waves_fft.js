'use strict';

var WavesFFT = function(dim, scale) {
	this.dim = dim;
	this.scale = scale;

	this.textures = {};

	this.textures.spectrum_height = this.gen_texture(this.dim);
	this.textures.spectrum_slope = this.gen_texture(this.dim);
	this.textures.spectrum_disp = this.gen_texture(this.dim);

	this.textures.fft_height = [
		this.textures.spectrum_height,
		this.gen_texture(this.dim)
	];

	this.textures.fft_slope = [
		this.textures.spectrum_slope,
		this.gen_texture(this.dim)
	];

	this.textures.fft_disp = [
		this.textures.spectrum_disp,
		this.gen_texture(this.dim)
	];

	this.textures.waves = [
			gl.createTexture(),
			gl.createTexture()
	];

	gl.bindTexture(gl.TEXTURE_2D, this.textures.waves[0]);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.dim, this.dim, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.generateMipmap(gl.TEXTURE_2D);

	gl.bindTexture(gl.TEXTURE_2D, this.textures.waves[1]);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.dim, this.dim, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.generateMipmap(gl.TEXTURE_2D);

	this.fbos = {};

	this.fbos.spectrum_height = gen_fbo(gl.TEXTURE_2D, this.textures.spectrum_height);
	this.fbos.spectrum_slope = gen_fbo(gl.TEXTURE_2D, this.textures.spectrum_slope);
	this.fbos.spectrum_disp = gen_fbo(gl.TEXTURE_2D, this.textures.spectrum_disp);

	this.fbos.fft_height = [
		gen_fbo(gl.TEXTURE_2D, this.textures.fft_height[0]),
		gen_fbo(gl.TEXTURE_2D, this.textures.fft_height[1])
	];

	this.fbos.fft_slope = [
		gen_fbo(gl.TEXTURE_2D, this.textures.fft_slope[0]),
		gen_fbo(gl.TEXTURE_2D, this.textures.fft_slope[1])
	];

	this.fbos.fft_disp = [
		gen_fbo(gl.TEXTURE_2D, this.textures.fft_disp[0]),
		gen_fbo(gl.TEXTURE_2D, this.textures.fft_disp[1])
	];

	this.fbos.waves = [
		gen_fbo(gl.TEXTURE_2D, this.textures.waves[0]),
		gen_fbo(gl.TEXTURE_2D, this.textures.waves[1])
	];

	return this;
};

// Creates a texture suitable for a step in the FFT process
WavesFFT.prototype.gen_texture = function() {
	var tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.dim, this.dim, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	return tex;
};

WavesFFT.prototype.resize = function(dim) {
	var self = this;

	this.dim = dim;

	for(var k in this.textures) {
		var v = this.textures[k];
		var texs = v instanceof Array ? v : [v];
		texs.forEach(function(tex) {
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, self.dim, self.dim, 0, gl.RGBA, glhalf.HALF_FLOAT_OES, null);
		});
	}

	this.textures.waves.forEach(function(tex) {
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.generateMipmap(gl.TEXTURE_2D);
	});

	gl.bindTexture(gl.TEXTURE_2D, null);
};

WavesFFT.prototype.set_anisotropy = function(anisotropy) {
	gl.bindTexture(gl.TEXTURE_2D, this.textures.waves[0]);
	gl.texParameteri(gl.TEXTURE_2D, glaniso.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);

	gl.bindTexture(gl.TEXTURE_2D, this.textures.waves[1]);
	gl.texParameteri(gl.TEXTURE_2D, glaniso.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);

	gl.bindTexture(gl.TEXTURE_2D, null);
};

WavesFFT.prototype.set_scale = function(scale) {
	this.scale = scale;
};

WavesFFT.prototype.render_spectrum = function(time) {
	gl.viewport(0, 0, this.dim, this.dim);

	gl.useProgram(programs.spectrum);

	gl.disable(gl.DEPTH_TEST);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.spectrum.a_position);
	gl.vertexAttribPointer(programs.spectrum.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform2f(programs.spectrum.u_dim, this.dim, this.dim);
	gl.uniform2fv(programs.spectrum.u_wind, wind);
	gl.uniform1f(programs.spectrum.u_amplitude, wavesamplitude);
	gl.uniform1f(programs.spectrum.u_scale, this.scale);
	gl.uniform2f(programs.spectrum.u_seed, 8, 8);

	gl.uniform1f(programs.spectrum.u_time, time);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.spectrum_height);
	gl.uniform1i(programs.spectrum.u_output, 0);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.spectrum_slope);
	gl.uniform1i(programs.spectrum.u_output, 1);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.spectrum_disp);
	gl.uniform1i(programs.spectrum.u_output, 2);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);
};

WavesFFT.prototype.render_wave_maps = function() {
	// Rendering to wave FBO

	gl.viewport(0, 0, this.dim, this.dim);

	gl.disable(gl.DEPTH_TEST);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.fft_height[0]);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.fft_height[1]);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.fft_slope[0]);
	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.fft_slope[1]);

	gl.activeTexture(gl.TEXTURE4);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.fft_disp[0]);
	gl.activeTexture(gl.TEXTURE5);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.fft_disp[1]);

	var niter = Math.round(Math.log(wavesdim)/Math.log(2));

	// Horizontal FFT
	gl.useProgram(programs.fft);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.fft.a_position);
	gl.vertexAttribPointer(programs.fft.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform2f(programs.fft.u_dim, wavesdim, wavesdim);

	for(var i = 0; i < niter; i++) {
		var texin = i&1;

		gl.uniform1f(programs.fft.u_bit, 1 << i);
		gl.uniform1f(programs.fft.u_bit2, 1 << i + 1);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.fft_height[texin^1]);
		gl.uniform1i(programs.fft.u_in, 0 + texin);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.fft_slope[texin^1]);
		gl.uniform1i(programs.fft.u_in, 2 + texin);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.fft_disp[texin^1]);
		gl.uniform1i(programs.fft.u_in, 4 + texin);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);
	}

	// Transpose
	gl.useProgram(programs.fft_transpose);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.fft_transpose.a_position);
	gl.vertexAttribPointer(programs.fft_transpose.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform2f(programs.fft_transpose.u_dim, wavesdim, wavesdim);

	var texin = niter&1;

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.fft_height[texin^1]);
	gl.uniform1i(programs.fft_transpose.u_in, 0 + texin);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.fft_slope[texin^1]);
	gl.uniform1i(programs.fft_transpose.u_in, 2 + texin);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.fft_disp[texin^1]);
	gl.uniform1i(programs.fft_transpose.u_in, 4 + texin);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	// Vertical FFT
	gl.useProgram(programs.fft);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.fft.a_position);
	gl.vertexAttribPointer(programs.fft.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform2f(programs.fft.u_dim, wavesdim, wavesdim);
	gl.uniform2f(programs.fft.u_increment, 0, 1/wavesdim);

	for(var i = 0; i < niter; i++) {
		var texin = (niter + i + 1)&1;

		gl.uniform1f(programs.fft.u_bit, 1 << i);
		gl.uniform1f(programs.fft.u_bit2, 1 << i + 1);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.fft_height[texin^1]);
		gl.uniform1i(programs.fft.u_in, 0 + texin);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.fft_slope[texin^1]);
		gl.uniform1i(programs.fft.u_in, 2 + texin);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.fft_disp[texin^1]);
		gl.uniform1i(programs.fft.u_in, 4 + texin);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);
	}

	// Finalize FFT (sign change and transpose)
	gl.useProgram(programs.fft_final);

	gl.disable(gl.DEPTH_TEST);

	gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
	gl.enableVertexAttribArray(programs.fft_final.a_position);
	gl.vertexAttribPointer(programs.fft_final.a_position, 2, gl.FLOAT, gl.FALSE, 0, 0);

	gl.uniform1i(programs.fft_final.u_in[0], 1);
	gl.uniform1i(programs.fft_final.u_in[1], 3);
	gl.uniform1i(programs.fft_final.u_in[2], 5);

	gl.uniform2f(programs.fft_final.u_dim, wavesdim, wavesdim);
	gl.uniform1f(programs.fft_final.u_choppiness, choppiness);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.waves[0]);
	gl.uniform1i(programs.fft_final.u_output, 0);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.waves[1]);
	gl.uniform1i(programs.fft_final.u_output, 1);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, quad.length);

	// Generate the wave mipmaps
	gl.bindTexture(gl.TEXTURE_2D, this.textures.waves[0]);
	gl.generateMipmap(gl.TEXTURE_2D);

	gl.bindTexture(gl.TEXTURE_2D, this.textures.waves[1]);
	gl.generateMipmap(gl.TEXTURE_2D);
};

