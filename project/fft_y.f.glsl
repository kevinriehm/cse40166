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
	float y_e = floor(gl_FragCoord.y/bit2)*bit2 + mod(gl_FragCoord.y, bit);
	float y_o = y_e + bit;

	vec2 c_e = vec2(gl_FragCoord.x, y_e)/u_dim;
	vec2 c_o = vec2(gl_FragCoord.x, y_o)/u_dim;
	vec2 uroot = cexp(2.*pi*gl_FragCoord.y/bit2);

	vec4 raw_e = texture2D(u_in, c_e);
	vec4 raw_o = texture2D(u_in, c_o);
	vec2 r0 = (raw_e.rg + cmul(uroot, raw_o.rg))/2.;
	vec2 r1 = (raw_e.ba + cmul(uroot, raw_o.ba))/2.;

	gl_FragColor = vec4(r0, r1);
}

