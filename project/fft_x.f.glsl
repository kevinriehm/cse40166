#version 100

#extension GL_EXT_draw_buffers: require

precision highp float;

uniform sampler2D u_in[3];

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

	vec2 c_e = vec2(x_e, gl_FragCoord.y)/u_dim;
	vec2 c_o = vec2(x_o, gl_FragCoord.y)/u_dim;
	vec2 uroot = cexp(2.*pi*gl_FragCoord.x/bit2);

	vec4 raw0_e = texture2D(u_in[0], c_e);
	vec4 raw0_o = texture2D(u_in[0], c_o);
	vec2 r0 = (raw0_e.rg + cmul(uroot, raw0_o.rg))/2.;

	vec4 raw1_e = texture2D(u_in[1], c_e);
	vec4 raw1_o = texture2D(u_in[1], c_o);
	vec2 r1_0 = (raw1_e.rg + cmul(uroot, raw1_o.rg))/2.;
	vec2 r1_1 = (raw1_e.ba + cmul(uroot, raw1_o.ba))/2.;

	vec4 raw2_e = texture2D(u_in[2], c_e);
	vec4 raw2_o = texture2D(u_in[2], c_o);
	vec2 r2_0 = (raw2_e.rg + cmul(uroot, raw2_o.rg))/2.;
	vec2 r2_1 = (raw2_e.ba + cmul(uroot, raw2_o.ba))/2.;

	gl_FragData[0] = vec4(r0, 0, 0);
	gl_FragData[1] = vec4(r1_0, r1_1);
	gl_FragData[2] = vec4(r2_0, r2_1);
}

