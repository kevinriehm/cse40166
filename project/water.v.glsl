#version 100

uniform sampler2D u_waves[2];

uniform mat4 u_camera;
uniform mat4 u_modelview;

uniform float u_choppiness;
uniform float u_scale;

uniform float u_edgesize[4];

attribute vec2 a_position;

varying float v_jacobian;
varying vec2 v_uv;
varying vec3 v_xyz;

void main() {
	float roundx0 = floor(a_position.x/u_edgesize[2] + 0.5)*u_edgesize[2];
	float roundx1 = floor(a_position.x/u_edgesize[3] + 0.5)*u_edgesize[3];
	float roundy0 = floor(a_position.y/u_edgesize[0] + 0.5)*u_edgesize[0];
	float roundy1 = floor(a_position.y/u_edgesize[1] + 0.5)*u_edgesize[1];

	vec2 coord = vec2(a_position.y == 0. ? roundx0 : a_position.y == 1. ? roundx1 : a_position.x,
		a_position.x == 0. ? roundy0 : a_position.x == 1. ? roundy1 : a_position.y);
	vec4 position = u_modelview*vec4(coord.x, 0, coord.y, 1);
	vec2 texcoord = position.xz/u_scale;

	float dxy = 1./u_scale;

	vec4 waves0 = texture2D(u_waves[0], texcoord);
	vec4 waves0_0 = texture2D(u_waves[0], texcoord + vec2(-dxy, 0));
	vec4 waves0_1 = texture2D(u_waves[0], texcoord + vec2( dxy, 0));
	vec4 waves0_2 = texture2D(u_waves[0], texcoord + vec2(0, -dxy));
	vec4 waves0_3 = texture2D(u_waves[0], texcoord + vec2(0,  dxy));

	float height = waves0.r;
	vec2 disp = waves0.gb;

	position.y += height;
	position.xz += u_choppiness*disp;

	v_jacobian = (1. + u_choppiness*(waves0_1.g - waves0_0.g)/2.)
			*(1. + u_choppiness*(waves0_3.b - waves0_2.b)/2.)
		- u_choppiness*(waves0_1.b - waves0_0.b)/2.
			*u_choppiness*(waves0_3.g - waves0_2.g)/2.;

	v_uv = texcoord;
	v_xyz = position.xyz;

	gl_Position = u_camera*position;
}

