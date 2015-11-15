#version 100

uniform mat4 u_camera;

attribute vec3 a_position;

varying vec3 v_xyz;

void main() {
	v_xyz = a_position;

	gl_Position = u_camera*vec4(a_position, 1);
}

