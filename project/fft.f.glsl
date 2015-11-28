#version 100

precision highp float;

uniform sampler2D u_in;

uniform vec2 u_dim;
uniform float u_bit;
uniform float u_bit2;
uniform vec2 u_increment;

const float pi = 3.141591265;

vec2 cexp(float x) {
	return vec2(cos(x), sin(x));
}

vec2 cmul(vec2 a, vec2 b) {
	return vec2(a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]);
}

void main() {
	float x_e = floor(gl_FragCoord.x/u_bit2)*u_bit2 + mod(gl_FragCoord.x, u_bit);
	float x_o = x_e + u_bit;

	vec2 c_e = vec2(x_e, gl_FragCoord.y)/u_dim;
	vec2 c_o = vec2(x_o, gl_FragCoord.y)/u_dim;
	vec2 uroot = cexp(pi*gl_FragCoord.x/u_bit);

	vec4 in_e = texture2D(u_in, c_e);
	vec4 in_o = texture2D(u_in, c_o);
	vec2 r0 = (in_e.rg + cmul(uroot, in_o.rg))/2.;
	vec2 r1 = (in_e.ba + cmul(uroot, in_o.ba))/2.;

	gl_FragColor = vec4(r0, r1);
}

