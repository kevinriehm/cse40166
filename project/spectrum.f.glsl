#version 100

#extension GL_EXT_draw_buffers: require

precision highp float;

uniform vec2 u_dim;
uniform vec2 u_wind;
uniform float u_amplitude;
uniform float u_scale;

uniform float u_time;

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

int reverse6(int x) {
	return reverse4(x/4) + 16*reverse2(x - x/4*4);
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

vec2 h(vec2 k, float t) {
	const float w0 = 2.*pi/200.; // Base frequency
//	float wt = floor(sqrt(g*length(k))/w0)*w0*t;
	float wt = sqrt(g*length(k))*t;
	return cmul(h0(k), cexp(wt)) + cmul(cconj(h0(-k)), cexp(-wt));
}

void main() {
	vec2 coord = vec2(reverse6(int(gl_FragCoord.x)), reverse6(int(gl_FragCoord.y)));
//	vec2 coord = gl_FragCoord.xy;
	vec2 k = 2.*pi*(coord - u_dim/2.)/u_scale;
	float lk = length(k);

	vec2 v = h(k, u_time);
	vec2 sx = cmul(v, vec2(0, k.x));
	vec2 sy = cmul(v, vec2(0, k.y));
	vec2 dx = cmul(v, vec2(0, lk < 0.001 ? 0. : -k.x/lk));
	vec2 dy = cmul(v, vec2(0, lk < 0.001 ? 0. : -k.y/lk));

	gl_FragData[0] = vec4(v, 0, 0); // Height
	gl_FragData[1] = vec4(sx, sy); // Slope
	gl_FragData[2] = vec4(dx, dy); // Displacement
}

