#version 100

uniform mat4 u_modelview;

attribute vec2 a_position;

void main() {
	gl_Position = u_modelview*vec4(a_position, 0, 1);
}

