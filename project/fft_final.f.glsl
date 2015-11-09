#version 100

precision highp float;

uniform sampler2D u_in;

uniform vec2 u_dim;

void main() {
	vec4 raw = texture2D(u_in, gl_FragCoord.xy/u_dim);
	float sign = 1. - 2.*mod(gl_FragCoord.x + gl_FragCoord.y, 2.);
	float height = sign*raw.r;
	gl_FragColor = vec4(height, 0, 0, 0);
}

