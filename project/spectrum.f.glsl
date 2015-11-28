#version 100

precision highp float;
precision highp int;

uniform vec2 u_dim;
uniform vec2 u_wind;
uniform float u_amplitude;
uniform float u_scale;
uniform vec2 u_seed;

uniform float u_time;

uniform int u_output;

const float g = 9.8;
const float pi = 3.141592653;

float sqr(float x) {
	return x*x;
}

float rand(vec4 seed) {
	return fract(437.5453*sin(dot(seed, vec4(12.9898, 78.233, 232.5172, 471.16986))));
}

int reverse2(int x) {
	if(x == 1)
		return 2;
	else if(x == 2)
		return 1;
	else return x;
}

int reverse4(int x) {
	return reverse2(x/4) + 4*reverse2(x - x/4*4);
}

int reverse8(int x) {
	return reverse4(x/16) + 16*reverse4(x - x/16*16);
}

int reverse16(int x) {
	return reverse8(x/256) + 256*reverse8(x - x/256*256);
}

int reverse_x(int x) {
	return reverse16(x)/int(exp2(16. - log2(u_dim.x)));
}

int reverse_y(int x) {
	return reverse16(x)/int(exp2(16. - log2(u_dim.y)));
}

vec2 cconj(vec2 a) {
	return vec2(a[0], -a[1]);
}

vec2 cexp(float x) {
	return vec2(cos(x), sin(x));
}

vec2 cmul(vec2 a, vec2 b) {
	return vec2(a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]);
}

vec2 gauss2(vec4 seed) {
	float u0 = rand(seed + vec4(73, 73, 73, 73));
	float u1 = rand(seed + vec4(79, 79, 79, 79));
	float x = sqrt(-2.*log(clamp(u0, 0.001, 1.)));
	return x*vec2(cos(2.*pi*u1), sin(2.*pi*u1));
}

float phillips(vec2 k) {
	const float small = 0.001; // Small waves to suppress

	float lk = length(k);
	float lw = length(u_wind);
	float L = lw*lw/g;

	if(lk < 0.001 || lw < 0.001)
		return 0.;

	return u_amplitude
		*exp(-1./sqr(lk*L) - sqr(lk*L*small))
		*sqr(sqr(dot(k/lk, u_wind/lw)/lk));
}

vec2 h0(vec2 k) {
	return gauss2(vec4(k, u_seed))*sqrt(phillips(k)/2.);
}

vec2 h(vec2 k, float t) {
	const float small = 0.01; // Threshold for capillary wave dynamics
	const float w0 = 2.*pi/256.; // Base frequency
	float lk = length(k);
//	float wt = t*floor(sqrt(g*lk)/w0)*w0;
	float wt = t*sqrt(g*lk*(lk*u_scale < small ? 1. + sqr(lk)*sqr(small) : 1.));
	return cmul(h0(k), cexp(wt)) + cmul(cconj(h0(-k)), cexp(-wt));
}

void main() {
	vec2 coord = vec2(
		reverse_x(int(gl_FragCoord.x)),
		reverse_y(int(gl_FragCoord.y))
	);

	vec2 k = 2.*pi*(coord - u_dim/2.)/u_scale;
	float lk = length(k);

	vec2 v = h(k, u_time);
	vec2 sx = cmul(v, vec2(0, k.x));
	vec2 sy = cmul(v, vec2(0, k.y));
	vec2 dx = cmul(v, vec2(0, lk < 0.001 ? 0. : k.x/lk));
	vec2 dy = cmul(v, vec2(0, lk < 0.001 ? 0. : k.y/lk));

	     if(u_output == 0) gl_FragColor = vec4(v, 0, 0); // Height
	else if(u_output == 1) gl_FragColor = vec4(sx, sy);  // Slope
	else if(u_output == 2) gl_FragColor = vec4(dx, dy);  // Displacement
}

