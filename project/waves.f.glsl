#version 100

precision highp float;

uniform sampler2D u_spectrum;

uniform float u_scale;

uniform float u_time;

const float pi = 3.141592653;
const float g = 9.8;

const int dim = 64; // Resolution of heightmap

// = a[0] - i*a[1]
vec2 cconj(vec2 a) {
	return vec2(a[0], -a[1]);
}

// = e^(ix)
vec2 cexp(float x) {
	return vec2(cos(x), sin(x));
}

// = (a[0] + i*a[1])*(b[0] + i*b[1])
vec2 cmul(vec2 a, vec2 b) {
	return vec2(a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]);
}

vec2 h0(vec2 k) {
	return texture2D(u_spectrum, (k*u_scale/2./pi + float(dim)/2.)/float(dim)).rg;
}

vec2 h(vec2 k, float t) {
	const float w0 = 2.*pi/200.; // Base frequency
//	float wt = floor(sqrt(g*length(k))/w0)*w0*t;
	float wt = sqrt(g*length(k))*t;
	return cmul(h0(k), cexp(wt)) + cmul(cconj(h0(-k)), cexp(-wt));
}

void main() {
	float height = 0.;
	vec2 slope = vec2(0);

	for(int y = -dim/2; y < dim/2; y++) {
		float ky = 2.*pi*float(y)/u_scale;
		vec2 ey = cexp(ky*gl_FragCoord.y);
		for(int x = -dim/2; x < dim/2; x++) {
			float kx = 2.*pi*float(x)/u_scale;
			vec2 r = cmul(h(vec2(kx, ky), u_time), cexp(kx*gl_FragCoord.x));
			r = cmul(ey, r);
			height += r[0];
			slope.x += cmul(r, vec2(0, kx))[0];
			slope.y += cmul(r, vec2(0, ky))[0];
		}
	}

	vec3 normal = normalize(vec3(-slope.x, 1, -slope.y));

	vec2 k = 2.*pi*(gl_FragCoord.xy/float(dim) - 1.)*float(dim)/u_scale;
//	gl_FragColor = vec4((cmul(h(k, u_time), cexp(dot(k, gl_FragCoord.xy)))[1] + 1.)/2., 0, 0, 0);
	gl_FragColor = vec4(height, normal);
//	gl_FragColor = vec4(texture2D(u_spectrum, gl_FragCoord.xy/float(dim)));
}

