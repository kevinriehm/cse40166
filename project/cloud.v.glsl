#version 100

attribute vec2 a_position;

varying vec2 v_uv;

void main() {
	v_uv = 0.5*a_position + 0.5;

	gl_Position = vec4(a_position, 0, 1);
}

