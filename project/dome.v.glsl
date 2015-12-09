#version 100

uniform mat4 u_camera;

uniform float u_horizon;

attribute vec3 a_position;

varying vec3 v_xyz;

void main() {
	v_xyz = a_position;

	gl_Position = u_camera*vec4(10.*u_horizon*a_position, 1);
}

