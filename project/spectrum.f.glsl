#version 100

precision highp float;

uniform vec2 u_dim;
uniform vec2 u_wind;
uniform float u_amplitude;
uniform float u_scale;

const float g = 9.8;
const float pi = 3.141592653;

float sqr(float x) {
	return x*x;
}

float rand(vec4 seed) {
	return fract(437.5453*sin(dot(seed, vec4(12.9898, 78.233, 232.5172, 471.16986))));
}

vec2 gauss2(vec4 seed) {
	float u0 = rand(seed + vec4(1, 1, 1, 1));
	float u1 = rand(seed + vec4(2, 2, 2, 2));
	float x = sqrt(-2.*log(clamp(u0, 0.001, 1.)));
	return x*vec2(cos(2.*pi*u1), sin(2.*pi*u1));
}

float phillips(vec2 k) {
	const float small = 0.001; // Small waves to suppress

	float lk = length(k);
	float lw = length(u_wind);
	float L = lw*lw/g;

	if(lk < 0.001)
		return 0.;

	return u_amplitude/sqr(sqr(lk))
		*exp(-1./sqr(lk*L))
		*sqr(dot(k/lk, u_wind/lw))
		*exp(-sqr(lk*L*small));
}

vec2 h0(vec2 k) {
	return gauss2(vec4(k, u_wind))*sqrt(phillips(k)/2.);
//	return gauss2(vec4(k, u_wind))/**vec2(sqrt(phillips(k)/2.))*/;
//	return /*gauss2(vec4(k, u_wind))**/vec2(sqrt(phillips(k)/2.));
}

void main() {
	vec2 k = 2.*pi*(gl_FragCoord.xy - u_dim/2.)/u_scale;
	gl_FragColor = vec4(h0(k), 0, 0);
}

