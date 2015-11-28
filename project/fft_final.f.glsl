#version 100

precision highp float;

uniform sampler2D u_in[3];

uniform vec2 u_dim;

uniform int u_output;

void main() {
	vec4 raw0 = texture2D(u_in[0], gl_FragCoord.yx/u_dim);
	vec4 raw1 = texture2D(u_in[1], gl_FragCoord.yx/u_dim);
	vec4 raw2 = texture2D(u_in[2], gl_FragCoord.yx/u_dim);

	float sign = 1. - 2.*mod(gl_FragCoord.x + gl_FragCoord.y, 2.);

	float scale = exp2(log2(u_dim.x) + log2(u_dim.y) - 7.);

	float height = sign*scale*raw0.r;
	float slopex = sign*scale*raw1.r;
	float slopey = sign*scale*raw1.b;
	float dispx = sign*scale*raw2.r;
	float dispy = sign*scale*raw2.b;

	if(u_output == 0) gl_FragColor = vec4(height, dispx, dispy, 0);
	if(u_output == 1) gl_FragColor = vec4(slopex, slopey, 0, 0);
}

