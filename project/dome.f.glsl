#version 100

precision mediump float;

uniform samplerCube u_sky;
uniform sampler2D u_cloud;

uniform vec3 u_sundir;
uniform vec3 u_sunlight;
uniform float u_suntheta;
uniform float u_time;
uniform float u_turbidity;
uniform vec2 u_wind;

uniform float u_cloudiness;

uniform float u_hdrscale;

varying vec3 v_xyz;

const float pi = 3.14159265;

float sun_power() {
	return exp(2048.*(dot(u_sundir, normalize(v_xyz)) - 1.));
}

float cloud_cover(vec3 r) {
	float cloudiness = texture2D(u_cloud, r.xz/(32.*r.y) - 0.00001*u_time*u_wind).r;

	cloudiness = max(0., 1. - exp(-5.*(cloudiness + u_cloudiness - 1.)));
	cloudiness *= 1. - smoothstep(0., 100., length(r.xz/r.y));

	return cloudiness;
}

void main() {
	// Atmosphere and Sun
	vec4 sky = textureCube(u_sky, v_xyz);
	vec3 rgb = sky.rgb + sun_power()*u_sunlight;

	// Clouds
	float cloud = cloud_cover(v_xyz);
	rgb = mix(rgb, u_sunlight/50.*max(0., dot(u_sundir, vec3(0, 1, 0))), cloud);

	// HDR -> LDR
	rgb *= u_hdrscale;
	float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
	rgb /= 1. + lum;

	gl_FragColor = vec4(rgb, 1);
}

