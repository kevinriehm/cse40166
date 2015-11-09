#version 100

precision highp float;

uniform sampler2D u_spectrum;

uniform float u_scale;

const float pi = 3.141592653;

const int dim = 64; // Resolution of heightmap

// = e^(ix)
vec2 cexp(float x) {
	return vec2(cos(x), sin(x));
}

// = (a[0] + i*a[1])*(b[0] + i*b[1])
vec2 cmul(vec2 a, vec2 b) {
	return vec2(a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]);
}

vec2 h(int x, int y) {
	return texture2D(u_spectrum, vec2(x, y)/float(dim)).rg;
}

void main() {
	float height = 0.;
	vec2 slope = vec2(0);

	for(int y = 0; y < dim; y++) {
		float ky = 2.*pi*float(y - dim/2)/u_scale;
		vec2 ey = cexp(ky*gl_FragCoord.y);

		vec2 r_height = vec2(0);
		vec2 slope_x = vec2(0);
		vec2 slope_y = vec2(0);

		for(int x = 0; x < dim; x++) {
			float kx = 2.*pi*float(x - dim/2)/u_scale;
			vec2 r = cmul(h(x, y), cexp(kx*gl_FragCoord.x));
			r_height += r;
			slope_x += cmul(r, vec2(0, kx));
			slope_y += cmul(r, vec2(0, ky));
		}

		height += cmul(ey, r_height)[0];
		slope.x += cmul(ey, slope_x)[0];
		slope.y += cmul(ey, slope_y)[0];
	}

	vec3 normal = normalize(vec3(-slope.x, 1, -slope.y));

	gl_FragColor = vec4(height, normal);
}

