#version 100

precision highp float;

uniform sampler2D u_waves[2];

uniform vec3 u_cameraxyz;
uniform float u_scale;
uniform float u_daytime;

uniform vec3 u_color;
uniform vec3 u_sky;

uniform vec3 u_sundir;

varying vec2 v_uv;
varying vec3 v_xyz;

const float pi = 3.14159265;

float sqr(float x) {
	return x*x;
}

void main() {
	const float sunedge = 0.99;
	const float sunpower = 10.;
	const vec3 suncolor = vec3(0.980, 0.839, 0.647);

	vec4 waves1 = texture2D(u_waves[1], v_uv);
	vec3 normal = normalize(vec3(-waves1.r, 1, -waves1.g));

	vec3 v = normalize(u_cameraxyz - v_xyz);
	vec3 r = reflect(-v, normal);

	vec3 sun = step(sunedge, dot(u_sundir, r))*sunpower*suncolor;

	vec3 sky = normalize(r);//u_sky*suncolor;

	const float n1 = 1., n2 = 1.333;
	float r0 = sqr((n1 - n2)/(n1 + n2));
	float fresnel = r0 + (1. - r0)*pow(1. - max(0., dot(normal, v)), 5.);

	vec3 rgb = (1. - fresnel)*u_color*suncolor + fresnel*(sky + sun);

	float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));

	gl_FragColor = vec4(rgb/(1. + lum), 1);
}

