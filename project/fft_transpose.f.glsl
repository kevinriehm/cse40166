#version 100

precision highp float;

uniform sampler2D u_in;

uniform vec2 u_dim;

void main() {
	gl_FragColor = texture2D(u_in, gl_FragCoord.yx/u_dim.yx);
}

