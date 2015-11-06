#version 100

uniform vec2 u_points[4];

attribute float a_interp;

void main() {
	float a = a_interp, ma = 1. - a;
	vec2 p = (ma*ma*ma*u_points[0]
		+ (4. - 6.*a*a + 3.*a*a*a)*u_points[1]
		+ (1. + 3.*a + 3.*a*a - 3.*a*a*a)*u_points[2]
		+ a*a*a*u_points[3])/6.;
	gl_Position = vec4(p, 0, 1);
}

