#version 100

precision highp float;

uniform sampler2D u_waves;

uniform vec3 u_color;

varying vec2 v_uv;
varying vec3 v_xyz;

void main() {
	const vec3 light = vec3(0, 2, 0);
	vec4 waves = texture2D(u_waves, v_uv);
	vec3 normal = waves.gba;
	gl_FragColor = vec4(u_color*waves.g, 1);
//	gl_FragColor = vec4(u_color*waves.a, 1);
//	gl_FragColor = vec4(u_color*dot(normal, normalize(light - v_xyz)), 1);
}

