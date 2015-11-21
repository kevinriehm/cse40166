#version 100

precision mediump float;

uniform samplerCube u_sky;

uniform vec3 u_sundir;
uniform float u_suntheta;
uniform float u_time;
uniform float u_turbidity;
uniform vec2 u_wind;

uniform float u_cloudiness;

uniform float u_hdrscale;

varying vec3 v_xyz;

const float pi = 3.14159265;

float sqr(float x) {
	return x*x;
}

float rand4(vec4 seed) {
	return fract(43758.5453*sin(dot(seed, vec4(12.9898, 78.233, 89.3414, 97.234123))));
}

vec3 simplex3_grad(vec3 coord) {
	const float period = 256.;

	coord = mod(coord, period);

	return vec3(
		floor(3.*rand4(vec4(coord, 1.))) - 1.,
		floor(3.*rand4(vec4(coord, 2.))) - 1.,
		floor(3.*rand4(vec4(coord, 3.))) - 1.
	);
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

vec3 sun_light() {
	const vec3 color = vec3(2024.04, 2550.38, 3005.75);
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

	return color*t_r*t_a*t_o*t_g*t_w;
}

float sun_power() {
	return exp(2048.*(dot(u_sundir, normalize(v_xyz)) - 1.));
}

// Simplex noise clouds
float cloud_cover() {
	vec2 cloudcoord = 0.5*v_xyz.xz/v_xyz.y;
	float clouddist = length(cloudcoord);

	cloudcoord -= u_time*u_wind/2000.;

	float cloud = 0.5*(
		  simplex3(vec3( 1.*cloudcoord, 0.01*u_time))
		+ simplex3(vec3( 2.*cloudcoord, 0.02*u_time))*0.5
		+ simplex3(vec3( 4.*cloudcoord, 0.04*u_time))*0.25
		+ simplex3(vec3(16.*cloudcoord, 0.04*u_time))*0.125
	)/(1. + 0.5 + 0.25 + 0.125) + 0.5;
	cloud *= 1. - smoothstep(1., 40., clouddist);
	cloud = max(0., 1. - exp(-5.*(cloud + u_cloudiness - 1.)));

	return cloud;
}

void main() {
	float theta = atan(length(v_xyz.xz), v_xyz.y);

	// Sky lights
	vec4 sky = textureCube(u_sky, v_xyz);

	vec3 sunlight = sun_light();
	float sunpower = sun_power();

	vec3 rgb = sky.rgb + sunpower*sunlight;

	float cloud = cloud_cover();
	rgb = mix(rgb, sunlight/50.*max(0., dot(u_sundir, vec3(0, 1, 0))), cloud);

	// HDR -> LDR
	rgb *= u_hdrscale;
	float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
	rgb /= 1. + lum;

	gl_FragColor = vec4(rgb, 1);
}

