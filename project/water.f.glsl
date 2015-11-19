#version 100

precision highp float;

uniform samplerCube u_sky;
uniform sampler2D u_waves[2];

uniform vec3 u_cameraxyz;
uniform float u_choppiness;
uniform float u_foaminess;
uniform float u_scale;

uniform vec3 u_color;

uniform vec3 u_sundir;
uniform float u_suntheta;
uniform float u_turbidity;

varying float v_jacobian;
varying vec2 v_uv;
varying vec3 v_xyz;

const float pi = 3.14159265;

float sqr(float x) {
	return x*x;
}

vec3 sqr3(vec3 x) {
	return x*x;
}

float rand2(vec2 seed) {
	return fract(43758.5453*sin(dot(seed, vec2(12.9898, 78.233))));
}

float smooth_rand2(vec2 seed) {
	vec2 b = floor(seed);
	vec2 o = fract(seed);
	return mix(
		mix(
			rand2(b),
			rand2(b + vec2(1, 0)),
			o.x
		),
		mix(
			rand2(b + vec2(0, 1)),
			rand2(b + vec2(1, 1)),
			o.x
		),
		o.y
	);
}

vec3 sun_light(vec3 dir) {
	const vec3 suncolor = vec3(2024.04, 2550.38, 3005.75);
	const vec3 lamb = vec3(0.700, 0.550, 0.450);
	const vec3 k_o = vec3(0.023, 0.085, 0.009);
	const vec3 k_g = vec3(0, 0, 0);
	const vec3 k_w = vec3(0.024, 0, 0);

	float b = 0.04608*u_turbidity - 0.04586;
	float m = 1./(cos(0.6*u_suntheta) + 0.15*pow(93.885 - degrees(0.6*u_suntheta), -1.253));

	vec3 t_r = exp(-0.008735*pow(lamb, vec3(-4.08*m)));
	vec3 t_a = exp(-b*pow(lamb, vec3(-1.3*m)));
	vec3 t_o = exp(-k_o*0.35*m);
	vec3 t_g = exp(-1.41*k_g*m*pow(1. + 118.93*k_g*m, vec3(-0.45)));
	vec3 t_w = exp(-0.2385*k_w*2.*m*pow(1. + 20.07*k_w*2.*m, vec3(-0.45)));

	return suncolor*t_r*t_a*t_o*t_g*t_w;
}

float sun_power(vec3 dir) {
	return exp(2048.*(dot(u_sundir, dir) - 1.));
}

void main() {
	vec4 waves1 = texture2D(u_waves[1], v_uv);
	vec3 normal = normalize(vec3(-waves1.r, 1, -waves1.g));

	vec3 v = normalize(u_cameraxyz - v_xyz);
	vec3 r = reflect(-v, normal);
	r.y = abs(r.y); // Hack, since we aren't doing inter-wave reflections

	vec3 sky = max(vec3(0), textureCube(u_sky, r).rgb);

	vec3 sunlight = sun_light(r);
	vec3 sun = sun_power(r)*sunlight;

	const float n1 = 1., n2 = 1.333;
	float r0 = sqr((n1 - n2)/(n1 + n2));
	float fresnel = r0 + (1. - r0)*pow(1. - max(0., dot(normal, v)), 5.);

	vec3 rgb = mix(u_color, sky + sun, fresnel);

	// Cresting foam
	rgb += sunlight/100.*max(0., dot(u_sundir, vec3(0, 1, 0)))
		*smoothstep(1. - u_foaminess, 1., 1. - v_jacobian)
		*(smooth_rand2(400.*v_uv) + smooth_rand2(200.*v_uv))/2.;

	rgb /= 5.;
	float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
	rgb /= 1. + lum;

	gl_FragColor = vec4(rgb, 1);
}

