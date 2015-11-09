#version 100

precision highp float;

uniform sampler2D u_in;

uniform vec2 u_dim;

uniform float u_stage;

const float pi = 3.14159265;

vec2 cexp(float x) {
	return vec2(cos(x), sin(x));
}

vec2 cmul(vec2 a, vec2 b) {
	return vec2(a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]);
}

void main() {
	float bit = exp2(u_stage);
	float bit2 = 2.*bit;
	float x_e = floor(gl_FragCoord.x/bit2)*bit2 + mod(gl_FragCoord.x, bit);
	float x_o = x_e + bit;
	vec4 raw_e = texture2D(u_in, vec2(x_e, gl_FragCoord.y)/u_dim);
	vec4 raw_o = texture2D(u_in, vec2(x_o, gl_FragCoord.y)/u_dim);
	vec2 in_e = raw_e.rg;
	vec2 in_o = raw_o.rg;
	vec2 r = (in_e + cmul(cexp(2.*pi*gl_FragCoord.x/bit2), in_o))/2.;
	gl_FragColor = vec4(r, 0, 0);
}

