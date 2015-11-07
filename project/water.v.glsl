#version 100

uniform sampler2D u_waves;

uniform mat4 u_camera;
uniform mat4 u_modelview;

attribute vec2 a_position;

varying vec2 v_uv;
varying vec3 v_xyz;

void main() {
	vec4 waves = texture2D(u_waves, a_position);
	float height = waves.r;
	v_uv = a_position;
//	v_xyz = vec3(a_position.x, 0, a_position.y);
	v_xyz = vec3(a_position, 0);
	gl_Position = u_camera*u_modelview*vec4(v_xyz, 1);
//	gl_Position.y += 0.01*height;
}

