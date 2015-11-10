#version 100

#extension GL_EXT_draw_buffers: require

precision highp float;

uniform sampler2D u_in[3];

uniform vec2 u_dim;

void main() {
	vec4 raw0 = texture2D(u_in[0], gl_FragCoord.xy/u_dim);
	vec4 raw1 = texture2D(u_in[1], gl_FragCoord.xy/u_dim);
	vec4 raw2 = texture2D(u_in[2], gl_FragCoord.xy/u_dim);

	float sign = 1. - 2.*mod(gl_FragCoord.x + gl_FragCoord.y, 2.);

	float height = sign*raw0.r;
	float slopex = sign*raw1.r;
	float slopey = sign*raw1.b;
	float dispx = sign*raw2.r;
	float dispy = sign*raw2.b;

	gl_FragData[0] = vec4(height, dispx, dispy, 0);
	gl_FragData[1] = vec4(slopex, slopey, 0.2, 0.8);
}

