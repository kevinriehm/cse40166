// OpenGL state
var gl;
var attribs;
var uniforms;

// Game state
var ball;
var paddle;

var nbounces;

var runnng;
var prevtime;

window.onload = function() {
	var canvas = document.getElementById('canvas');

	gl = WebGLUtils.setupWebGL(canvas);
	if(!gl) alert('WebGL unavailable');

	// Set up the OpenGL environment
	gl.clearColor(0, 0, 0, 1);

	// Set up the shader program
	var program = initShaders(gl, 'basic.v.glsl', 'basic.f.glsl');
	gl.useProgram(program);

	attribs = {
		position: find_attribute(program, 'a_position')
	};

	gl.enableVertexAttribArray(attribs.position);

	uniforms = {
		color: find_uniform(program, 'u_color'),
		offset: find_uniform(program, 'u_offset')
	};

	// Set up the ball
	var ballnvertices = 40;
	var ballradius = 0.03;

	ball = {
		color: vec3(0.2, 0.2, 0.8),
		offset: vec2(Math.random(), 1), // Somewhere on the top wall
		radius: ballradius,
		nvertices: ballnvertices,
		verticesbuffer: array_to_buffer(gl.ARRAY_BUFFER,
			Array.apply(0, Array(ballnvertices)).map(function(x, i, arr) {
				var angle = 2*Math.PI*(i - 1)/(arr.length - 2);
				return i == 0 ? vec2(0, 0)
					: vec2(ballradius*Math.cos(angle), ballradius*Math.sin(angle));
			})),
		speed: 0.3,
		direction: (function() {
			var angle = 1/8 + 3/4*Math.random();
			angle = -(angle < 1/2 ? 7/8*angle : 7/8*angle + 1/8)*Math.PI;
			return vec2(Math.cos(angle), Math.sin(angle));
		})()
	};

	// Set up the paddle
	var paddlewidth = 0.2;
	var paddleheight = 0.01;

	paddle = {
		color: vec3(1, 1, 1),
		offset: vec2(0.5, 0.01), // Bottom wall
		width: paddlewidth,
		height: paddleheight,
		nvertices: 4,
		verticesbuffer: array_to_buffer(gl.ARRAY_BUFFER,[
			vec2( paddlewidth/2,  paddleheight/2),
			vec2(-paddlewidth/2,  paddleheight/2),
			vec2( paddlewidth/2, -paddleheight/2),
			vec2(-paddlewidth/2, -paddleheight/2)
		]),
		speed: 0.1
	};

	// Register for input events
	document.getElementById('left' ).addEventListener('click', function() { move_paddle(-1); });
	document.getElementById('right').addEventListener('click', function() { move_paddle( 1); });

	document.getElementById('faster').addEventListener('click', function() { accelerate_ball( 1); });
	document.getElementById('slower').addEventListener('click', function() { accelerate_ball(-1); });

	window.addEventListener('keydown', function(event) {
		switch(event.keyCode) {
		case 37: move_paddle(-1);     break; // Left
		case 38: accelerate_ball( 1); break; // Up
		case 39: move_paddle( 1);     break; // Right
		case 40: accelerate_ball(-1); break; // Down

		default: return;
		}

		event.preventDefault();
	});

	// Other game state
	nbounces = 0;
	update_bounces_display();

	running = true;

	// Start the game
	window.requestAnimationFrame(render);
};

function array_to_buffer(target, data) {
	var buffer = gl.createBuffer();
	gl.bindBuffer(target, buffer);
	gl.bufferData(target, flatten(data), gl.STATIC_DRAW);
	return buffer;
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

function move_paddle(amount) {
	paddle.offset[0] += amount*paddle.speed;
}

function accelerate_ball(amount) {
	var minspeed = 0.1, maxspeed = 2;

	ball.speed = Math.max(minspeed, Math.min(ball.speed + 0.1*amount, maxspeed));
	ball.color = mix(vec3(0.2, 0.2, 0.8), vec3(0.8, 0.2, 0), (ball.speed - minspeed)/(maxspeed - minspeed));
}

function update_bounces_display() {
	document.getElementById('bounces').textContent = nbounces + ' bounce' + (nbounces === 1 ? '' : 's');
}

function stopRunning() {
	running = false;

	document.getElementById('left' ).disabled = true;
	document.getElementById('right').disabled = true;

	document.getElementById('faster').disabled = true;
	document.getElementById('slower').disabled = true;

	alert('You missed! Game over!');
}

function update(prev, now) {
	var dt = (now - prev)/1000;

	// Move the ball
	ball.offset[0] += dt*ball.speed*ball.direction[0];
	ball.offset[1] += dt*ball.speed*ball.direction[1];

	// Left wall
	var ballleft = ball.radius;
	if(ball.offset[0] < ballleft) {
		ball.offset[0] = 2*ballleft - ball.offset[0];
		ball.direction[0] *= -1;
	}

	// Right wall
	var ballright = 1 - ball.radius;
	if(ball.offset[0] > ballright) {
		ball.offset[0] = 2*ballright - ball.offset[0];
		ball.direction[0] *= -1;
	}

	// Top wall
	var balltop = 1 - ball.radius;
	if(ball.offset[1] > balltop) {
		ball.offset[1] = 2*balltop - ball.offset[1];
		ball.direction[1] *= -1;
	}

	// Paddle (bounce)
	var paddletop = paddle.offset[1] + paddle.height/2 + ball.radius;
	var paddleleft = paddle.offset[0] - paddle.width/2;
	var paddleright = paddle.offset[0] + paddle.width/2;
	if(ball.offset[1] < paddletop) {
		if(paddleleft < ball.offset[0] && ball.offset[0] < paddleright // In the middle
			|| length(subtract(vec2(paddleleft,  paddletop), ball.offset)) < ball.radius    // Left corner
			|| length(subtract(vec2(paddleright, paddletop), ball.offset)) < ball.radius) { // Right corner
			ball.offset[1] = 2*paddletop - ball.offset[1];
			ball.direction[1] *= -1;

			nbounces++;
			update_bounces_display();
		} else stopRunning(); // Game over
	}

	// Sanity check
	ball.offset[0] = Math.max(ball.radius, Math.min(ball.offset[0], 1 - ball.radius));
	ball.offset[1] = Math.max(ball.radius, Math.min(ball.offset[1], 1 - ball.radius));

	// Paddle sanity check
	paddle.offset[0] = Math.max(paddle.width/2, Math.min(paddle.offset[0], 1 - paddle.width/2));
	paddle.offset[1] = Math.max(paddle.height/2, Math.min(paddle.offset[1], 1 - paddle.height/2));
}

function render(now) {
	// Handle frame timing
	if(!prevtime || now - prevtime > 1000)
		prevtime = now;

	// Execute the game logic
	update(prevtime, now);

	// Render the new frame
	gl.clear(gl.COLOR_BUFFER_BIT);

	// Render the ball
	gl.uniform3fv(uniforms.color, ball.color);
	gl.uniform2fv(uniforms.offset, ball.offset);

	gl.bindBuffer(gl.ARRAY_BUFFER, ball.verticesbuffer);
	gl.vertexAttribPointer(attribs.position, 2, gl.FLOAT, false, 0, 0);

	gl.drawArrays(gl.TRIANGLE_FAN, 0, ball.nvertices);

	// Render the paddle
	gl.uniform3fv(uniforms.color, paddle.color);
	gl.uniform2fv(uniforms.offset, paddle.offset);

	gl.bindBuffer(gl.ARRAY_BUFFER, paddle.verticesbuffer);
	gl.vertexAttribPointer(attribs.position, 2, gl.FLOAT, false, 0, 0);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, paddle.nvertices);

	// Do it again?
	if(running) {
		prevtime = now;
		window.requestAnimationFrame(render);
	}
}

