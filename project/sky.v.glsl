#version 100

uniform int u_face;

attribute vec2 a_position;

varying vec3 v_xyz;

void main() {
	if(u_face == 0)      v_xyz = vec3( 1, -a_position.y, -a_position.x);
	else if(u_face == 1) v_xyz = vec3(-1, -a_position.y,  a_position.x);
	else if(u_face == 2) v_xyz = vec3( a_position.x,  1,  a_position.y);
	else if(u_face == 3) v_xyz = vec3( a_position.x, -a_position.y,  1);
	else                 v_xyz = vec3(-a_position.x, -a_position.y, -1);

	gl_Position = vec4(a_position, 0, 1);
}

