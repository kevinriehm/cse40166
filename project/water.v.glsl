#version 100

uniform sampler2D u_waves0[2];
uniform sampler2D u_waves1[2];

uniform mat4 u_camera;
uniform mat4 u_modelview;

uniform float u_choppiness;
uniform float u_scale[2];

uniform float u_edgesize[4];

attribute vec2 a_position;

varying vec2 v_uv[2];
varying vec3 v_xyz;

void main() {
	float roundx0 = floor(a_position.x/u_edgesize[2] + 0.5)*u_edgesize[2];
	float roundx1 = floor(a_position.x/u_edgesize[3] + 0.5)*u_edgesize[3];
	float roundy0 = floor(a_position.y/u_edgesize[0] + 0.5)*u_edgesize[0];
	float roundy1 = floor(a_position.y/u_edgesize[1] + 0.5)*u_edgesize[1];

	vec2 coord = vec2(a_position.y == 0. ? roundx0 : a_position.y == 1. ? roundx1 : a_position.x,
		a_position.x == 0. ? roundy0 : a_position.x == 1. ? roundy1 : a_position.y);
	vec4 position = u_modelview*vec4(coord.x, 0, coord.y, 1);

	vec2 texcoord0 = position.xz/u_scale[0] + 0.1;
	vec2 texcoord1 = position.xz/u_scale[1] + 0.2;

	vec4 waves00 = texture2D(u_waves0[0], texcoord0);
	vec4 waves10 = texture2D(u_waves1[0], texcoord1);

	float height = waves00.r + waves10.r;
	vec2 disp = waves00.gb + waves10.gb;

	position.y += height;
	position.xz += u_choppiness*disp;

	v_uv[0] = texcoord0;
	v_uv[1] = texcoord1;
	v_xyz = position.xyz;

	gl_Position = u_camera*position;
}

