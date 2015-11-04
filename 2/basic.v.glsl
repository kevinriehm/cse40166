#version 100

uniform mat4 u_modelview;
uniform mat4 u_projection;

attribute vec3 a_position;

void main() {
	gl_Position = u_projection*u_modelview*vec4(a_position, 1);
}

