#version 100

precision mediump float;

varying vec3 v_xyz;

void main() {
	gl_FragColor = vec4(normalize(v_xyz), 1);
}

