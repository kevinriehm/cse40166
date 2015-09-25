#version 100

uniform vec2 u_offset;

attribute vec2 a_position;

void main() {
	gl_Position = vec4(2.*(u_offset + a_position) - 1., 0, 1);
}

