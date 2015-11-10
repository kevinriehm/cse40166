#version 100

precision highp float;

uniform sampler2D u_waves[2];

uniform vec3 u_color;
uniform float u_scale;

varying vec2 v_uv;
varying vec3 v_xyz;

void main() {
	const vec3 lightdir = vec3(0, -1, -1);
	vec4 waves1 = texture2D(u_waves[1], v_uv);
	vec3 normal = normalize(vec3(-waves1.r, 1, -waves1.g));
//	gl_FragColor = vec4(u_color*dot(normal, normalize(-lightdir)), 1);
//	gl_FragColor = vec4(vec3(normal), 1);
	gl_FragColor = vec4(waves1.g, waves1.a, 1, 1);
}

