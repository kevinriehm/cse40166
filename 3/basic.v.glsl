#version 100

uniform float u_pointsize;

attribute vec2 a_position;

void main() {
	gl_PointSize = u_pointsize;
	gl_Position = vec4(a_position, 0, 1);
}

