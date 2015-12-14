'use script';

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

// Creates a framebuffer and attaches a texture to it
function gen_fbo(c0type, c0tex) {
	var fbo = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, c0type, c0tex, 0);

	if(gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
		alert('FATAL: incomplete framebuffer');
		console.trace();
	}

	gl.clear(gl.COLOR_BUFFER_BIT);

	return fbo;
}

// Retrieves an image file and loads it into a texture asynchronously
function load_image(url) {
	var tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

	var image = new Image();
	image.onload = function() {
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.generateMipmap(gl.TEXTURE_2D);

		setTimeout(function() {
			if(!playing)
				window.requestAnimationFrame(render);
		}, 300);
	};
	image.src = url;

	return tex;
}

