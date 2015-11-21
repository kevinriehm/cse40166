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

uniform float u_hdrscale;

uniform float u_time;
uniform vec2 u_wind;
uniform float u_cloudiness;

varying float v_jacobian;
varying vec2 v_uv;
varying vec3 v_xyz;

const float pi = 3.14159265;

float sqr(float x) {
	return x*x;
}

float rand3(vec3 seed) {
	return fract(43758.5453*sin(dot(seed, vec3(12.9898, 78.233, 89.3414))));
}

vec3 simplex3_grad(vec3 coord) {
	const float period = 256.;

	int i = int(12.*rand3(mod(coord, period)));

	if(i ==  0) return vec3( 0, -1, -1);
	if(i ==  1) return vec3( 0, -1,  1);
	if(i ==  2) return vec3( 0,  1, -1);
	if(i ==  3) return vec3( 0,  1,  1);
	if(i ==  4) return vec3(-1,  0, -1);
	if(i ==  5) return vec3(-1,  0,  1);
	if(i ==  6) return vec3(-1, -1,  0);
	if(i ==  7) return vec3(-1,  1,  0);
	if(i ==  8) return vec3( 1,  0, -1);
	if(i ==  9) return vec3( 1,  0,  1);
	if(i == 10) return vec3( 1, -1,  0);
	            return vec3( 1,  1,  0);
}

float simplex3(vec3 coord) {
	vec3 skew = coord + vec3(coord.x + coord.y + coord.z)/3.;
	vec3 bskew = floor(skew);
	vec3 base = bskew - vec3(bskew.x + bskew.y + bskew.z)/6.;
	vec3 offset = coord - base;

	vec3 cskew1, cskew2;
	if(offset.x > offset.y) {
		if(offset.y > offset.z) {
			cskew1 = vec3(1, 0, 0);
			cskew2 = vec3(1, 1, 0);
		} else if(offset.x > offset.z) {
			cskew1 = vec3(1, 0, 0);
			cskew2 = vec3(1, 0, 1);
		} else {
			cskew1 = vec3(0, 0, 1);
			cskew2 = vec3(1, 0, 1);
		}
	} else {
		if(offset.z > offset.y) {
			cskew1 = vec3(0, 0, 1);
			cskew2 = vec3(0, 1, 1);
		} else if(offset.z > offset.x) {
			cskew1 = vec3(0, 1, 0);
			cskew2 = vec3(0, 1, 1);
		} else {
			cskew1 = vec3(0, 1, 0);
			cskew2 = vec3(1, 1, 0);
		}
	}

	vec3 c1 = offset - cskew1 + 1./6.;
	vec3 c2 = offset - cskew2 + 1./3.;
	vec3 c3 = offset - 1./2.;

	return 32.*(
		  sqr(sqr(max(0., 0.5 - dot(offset, offset))))*dot(offset, simplex3_grad(bskew))
		+ sqr(sqr(max(0., 0.5 - dot(c1, c1))))*dot(c1, simplex3_grad(bskew + cskew1))
		+ sqr(sqr(max(0., 0.5 - dot(c2, c2))))*dot(c2, simplex3_grad(bskew + cskew2))
		+ sqr(sqr(max(0., 0.5 - dot(c3, c3))))*dot(c3, simplex3_grad(bskew + vec3(1)))
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

	vec3 t = exp(
		- 0.008735*pow(lamb, vec3(-4.08*m))
		- b*pow(lamb, vec3(-1.3*m))
		- k_o*0.35*m
		- 1.41*k_g*m*pow(1. + 118.93*k_g*m, vec3(-0.45))
		- 0.2385*k_w*2.*m*pow(1. + 20.07*k_w*2.*m, vec3(-0.45))
	);

	return t*suncolor;
}

float sun_power(vec3 dir) {
	return exp(2048.*(dot(u_sundir, dir) - 1.));
}

// Simplex noise clouds
float cloud_cover(vec3 r) {
	vec2 cloudcoord = 0.5*r.xz/r.y;
	vec2 cloudoffset = -u_time*u_wind/2000.;

	float cloud = ((
		  simplex3(vec3(vec2(1, 4) +  1.0*cloudcoord + cloudoffset, 0.01*u_time))/1.0
		+ simplex3(vec3(vec2(2, 3) +  2.0*cloudcoord + cloudoffset, 0.02*u_time))/2.0
		+ simplex3(vec3(vec2(3, 2) +  4.0*cloudcoord + cloudoffset, 0.04*u_time))/4.0
		+ simplex3(vec3(vec2(4, 1) + 16.0*cloudcoord + cloudoffset, 0.04*u_time))/8.0
	)/(1./1. + 1./2. + 1./4. + 1./8.) + 1.)/2.;
	cloud *= 1. - smoothstep(1., 40., length(cloudcoord));
	cloud = max(0., 1. - exp(-5.*(cloud + u_cloudiness - 1.)));

	return cloud;
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

	// Cloudiness
	float cloud = cloud_cover(r);
	sky = mix(sky, sunlight/50.*max(0., dot(u_sundir, vec3(0, 1, 0))), cloud);

	const float n1 = 1., n2 = 1.333;
	float r0 = sqr((n1 - n2)/(n1 + n2));
	float fresnel = r0 + (1. - r0)*pow(1. - max(0., dot(normal, v)), 5.);

	// Cresting foam
	vec3 foam = sunlight/50.*max(0., dot(u_sundir, r))
		*smoothstep(-0.05, 0.1, dot(u_sundir, vec3(0, 1, 0)))
		*((
			  simplex3(vec3(5.*u_scale*v_uv, 0.5*u_time))*2.
			+ simplex3(vec3(1.*u_scale*v_uv, 0.1*u_time))*1.
		)/(2. + 1.) + 1.)/2.;
	float foaminess = smoothstep(1. - u_foaminess, 1., 1. - v_jacobian);

	vec3 rgb = mix(u_color, sky + (foaminess > 0. ? vec3(0) : sun), fresnel)
		+ foam*foaminess*(1. + fresnel);

	rgb *= u_hdrscale;
	float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
	rgb /= 1. + lum;

	gl_FragColor = vec4(rgb, 1);
}

