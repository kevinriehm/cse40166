#version 100

precision highp float;

uniform vec3 u_sundir;
uniform float u_suntheta;
uniform float u_turbidity;

varying vec3 v_xyz;

const float pi = 3.14159265;

float sqr(float x) {
	return x*x;
}

// Perez's skylight distribution model
float perez(float theta, float gamma, float A, float B, float C, float D, float E) {
	return (1. + A*exp(B/cos(theta)))*(1. + C*exp(D*gamma) + E*sqr(cos(gamma)));
}

float zenith_xy(mat4 coeff) {
	vec4 turvec = vec4(sqr(u_turbidity), u_turbidity, 1, 0);
	vec4 thevec = vec4(u_suntheta*sqr(u_suntheta), sqr(u_suntheta), u_suntheta, 1);
	return dot(turvec, coeff*thevec);
}

float zenith_Y() {
	float chi = (4./9. - u_turbidity/120.)*(pi - 2.*u_suntheta);
	return (4.0453*u_turbidity - 4.9710)*tan(chi) - 0.2155*u_turbidity + 2.4192;
}

void main() {
	// Coefficients for zenith chromaticity
	const mat4 coeff_zx = mat4(
		 0.00166, -0.02903,  0.11693, 0,
		-0.00375,  0.06377, -0.21196, 0,
		 0.00209, -0.03202,  0.06052, 0,
		 0      ,  0.00394,  0.25886, 0
	);

	const mat4 coeff_zy = mat4(
		 0.00275, -0.04214,  0.15346, 0,
		-0.00610,  0.08970, -0.26756, 0,
		 0.00317, -0.04153,  0.06670, 0,
		 0      ,  0.00516,  0.26688, 0
	);

	// Coefficients for distribution function
	float A_x = -0.0193*u_turbidity - 0.2592;
	float B_x = -0.0665*u_turbidity + 0.0008;
	float C_x = -0.0004*u_turbidity + 0.2125;
	float D_x = -0.0641*u_turbidity - 0.8989;
	float E_x = -0.0033*u_turbidity + 0.0452;

	float A_y = -0.0167*u_turbidity - 0.2608;
	float B_y = -0.0950*u_turbidity + 0.0092;
	float C_y = -0.0079*u_turbidity + 0.2102;
	float D_y = -0.0441*u_turbidity - 1.6537;
	float E_y = -0.0109*u_turbidity + 0.0529;

	float A_Y =  0.1787*u_turbidity - 1.4630;
	float B_Y = -0.3554*u_turbidity + 0.4275;
	float C_Y = -0.0227*u_turbidity + 5.3251;
	float D_Y =  0.1206*u_turbidity - 2.5771;
	float E_Y = -0.0670*u_turbidity + 0.3703;

	// View angles
	float theta = clamp(atan(length(v_xyz.xz), v_xyz.y), 0., pi/2. - 0.01);
	float gamma = acos(dot(u_sundir, normalize(v_xyz)));

	// CIE xyY color space via fit model
	float ch_x = zenith_xy(coeff_zx)*perez(theta, gamma, A_x, B_x, C_x, D_x, E_x)
		/perez(0., u_suntheta, A_x, B_x, C_x, D_x, E_x);
	float ch_y = zenith_xy(coeff_zy)*perez(theta, gamma, A_y, B_y, C_y, D_y, E_y)
		/perez(0., u_suntheta, A_y, B_y, C_y, D_y, E_y);
	float ch_Y = zenith_Y()*perez(theta, gamma, A_Y, B_Y, C_Y, D_Y, E_Y)
		/perez(0., u_suntheta, A_Y, B_Y, C_Y, D_Y, E_Y);

	// xyY -> XYZ
	vec3 XYZ = vec3(ch_Y/ch_y*ch_x, ch_Y, ch_Y/ch_y*(1. - ch_x - ch_y));

	// XYZ -> linear sRGB
	vec3 rgb = mat3(
		 3.2406, -0.9689,  0.0557,
		-1.5372,  1.8758, -0.2040,
		-0.4986,  0.0415,  1.0570
	)*XYZ;
	rgb = max(vec3(0), rgb);

	// Handle sunrise and sunset
	const vec2 sunset = vec2(pi/2. + 0.2, pi/2. + 0.5);
	rgb = (1. - smoothstep(sunset[0], sunset[1], u_suntheta))*rgb;

	rgb = max(rgb, 0.);

	gl_FragColor = vec4(rgb, 0);
}

