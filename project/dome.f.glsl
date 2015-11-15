#version 100

precision mediump float;

uniform samplerCube u_sky;

varying vec3 v_xyz;

void main() {
	vec3 rgb = textureCube(u_sky, v_xyz).rgb;

	// HDR -> LDR
	rgb *= 1./5.;
	float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
	rgb = rgb/(1. + lum);

	gl_FragColor = vec4(rgb, 1);
}

