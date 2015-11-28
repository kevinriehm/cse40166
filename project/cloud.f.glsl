#version 100

precision highp float;

varying vec2 v_uv;

const float pi = 3.14159265;

// *Actual* modulus, not remainder
vec3 modulus3(vec3 x, float m) {
	return mod(mod(x, m) + m, m);
}

float sqr(float x) {
	return x*x;
}

vec4 sqr(vec4 x) {
	return x*x;
}

float rand(vec2 seed) {
	return fract(43758.5453*sin(dot(seed, vec2(12.9898, 78.233))));
}

vec4 rand(vec4 seed) {
	return vec4(
		rand(seed.xy),
		rand(seed.zw),
		rand(seed.zx),
		rand(seed.wy)
	);
}

vec4 simplex_grad(vec4 coord) {
	return floor(3.*rand(coord)) - 1.;
}

float simplex(vec4 coord) {
	vec4 f = vec4((sqrt(5.) - 1.)/4.);
	vec4 g = vec4((1. - 1./sqrt(5.))/4.);

	vec4 bskew = floor(coord + dot(f, coord));
	vec4 c0 = coord - bskew + dot(g, bskew);

	vec4 cskew1 = step(c0.yxxx, c0)*step(c0.zzyy, c0)*step(c0.wwwz, c0);
	vec4 cskew2 = step(2., step(c0.yxxx, c0) + step(c0.zzyy, c0) + step(c0.wwwz, c0));
	vec4 cskew3 = 1. - step(c0, c0.yxxx)*step(c0, c0.zzyy)*step(c0, c0.wwwz);

	vec4 c1 = c0 - cskew1 + g;
	vec4 c2 = c0 - cskew2 + 2.*g;
	vec4 c3 = c0 - cskew3 + 3.*g;
	vec4 c4 = c0 - 1. + 4.*g;

	vec4 d03 = max(0.5 - vec4(dot(c0, c0), dot(c1, c1), dot(c2, c2), dot(c3, c3)), 0.);
	float d4 = max(0.5 - dot(c4, c4), 0.);

	vec4 g03 = vec4(
		dot(c0, simplex_grad(bskew)),
		dot(c1, simplex_grad(bskew + cskew1)),
		dot(c2, simplex_grad(bskew + cskew2)),
		dot(c3, simplex_grad(bskew + cskew3))
	);
	float g4 = dot(c4, simplex_grad(bskew + 1.));

	return 27.*(dot(sqr(sqr(d03)), g03) + sqr(sqr(d4))*g4);
}

// Produces tileable 2D noise
float simplex_tiled(vec2 coord, vec2 period) {
	const vec2 base = vec2(0);

	vec2 angles = 2.*pi*coord/period;

	return simplex(base.xyxy + period.xyxy*vec4(cos(angles), sin(angles))/(2.*pi));
}

void main() {
	const vec2 period = vec2(16);
	const vec4 weights = vec4(1, 0.5, 0.25, 0.125);

	vec2 coord = v_uv*period;

	vec4 cloud = vec4(
		simplex_tiled( 1.*coord,  1.*period),
		simplex_tiled( 2.*coord,  2.*period),
		simplex_tiled( 4.*coord,  4.*period),
		simplex_tiled(16.*coord, 16.*period)
	);

	float cloudiness = dot(cloud, weights)/dot(vec4(1), weights);

	gl_FragColor = vec4(0.5*cloudiness + 0.5);
}

