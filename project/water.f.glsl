#version 100

precision highp float;

uniform samplerCube u_sky;
uniform sampler2D u_cloud;
uniform sampler2D u_waves[2];

uniform vec3 u_cameraxyz;
uniform float u_choppiness;
uniform float u_foaminess;
uniform float u_scale;

uniform vec3 u_color;

uniform vec3 u_sundir;
uniform vec3 u_sunlight;
uniform float u_suntheta;
uniform float u_turbidity;

uniform float u_hdrscale;

uniform float u_time;
uniform vec2 u_wind;
uniform float u_cloudiness;

varying float v_jacobian;
varying vec2 v_uv;
varying vec3 v_xyz;

float sun_power(vec3 dir) {
	return exp(2048.*(dot(u_sundir, dir) - 1.));
}

float cloud_cover(vec3 r) {
	float cloudiness = texture2D(u_cloud, r.xz/(32.*r.y) - 0.00001*u_time*u_wind).r;

	cloudiness = max(0., 1. - exp(-5.*(cloudiness + u_cloudiness - 1.)));
	cloudiness *= 1. - smoothstep(0., 100., length(r.xz/r.y));

	return cloudiness;
}

void main() {
	vec4 waves1 = texture2D(u_waves[1], v_uv);
	vec3 normal = normalize(vec3(-waves1.r, 1, -waves1.g));

	vec3 v = normalize(u_cameraxyz - v_xyz);
	vec3 r = reflect(-v, normal);
	r.y = abs(r.y); // Hack, since we aren't doing inter-wave reflections

	// Atmosphere and Sun
	vec3 sky = textureCube(u_sky, r).rgb;
	vec3 sun = sun_power(r)*u_sunlight;

	// Clouds
	float cloud = cloud_cover(r);
	sky = mix(sky, u_sunlight/50.*max(0., dot(u_sundir, vec3(0, 1, 0))), cloud);

	// Water reflectivity
	const float n1 = 1., n2 = 1.333;
	float r0 = pow((n1 - n2)/(n1 + n2), 2.);
	float fresnel = r0 + (1. - r0)*pow(1. - max(0., dot(normal, v)), 5.);

	// Cresting foam
	vec3 foam = u_sunlight/50.*max(0., dot(u_sundir, r))
		*smoothstep(-0.05, 0.1, dot(u_sundir, vec3(0, 1, 0)))
		*vec3(1);
	float foaminess = smoothstep(1. - u_foaminess, 1., 1. - v_jacobian);

	vec3 rgb = mix(u_color, sky + (foaminess > 0. ? vec3(0) : sun), fresnel)
		+ foam*foaminess*(0.7 + fresnel);

	rgb *= u_hdrscale;
	float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
	rgb /= 1. + lum;

	gl_FragColor = vec4(rgb, 1);
}

