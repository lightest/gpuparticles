// Particles original position, which we need if we want to reset them.
// For instance to respawn the particle at the model surface.
uniform sampler2D uParticlesOriginPosition;

// Particles position calculated on the previous frame
uniform sampler2D uParticlesPositions;

// Elapsed time.
uniform float uTime;

varying vec2 vUv;

float rand(vec2 co)
{
	return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main()
{
	vec3 pos = texture2D(uParticlesPositions, vUv).xyz;


	// if ( rand(vUv + timer ) > 0.97 ) {

	// 	pos = texture2D( origin, vUv ).xyz;


	// } else {

	// 	float x = pos.x + timer;
	// 	float y = pos.y;
	// 	float z = pos.z;

	// 	pos.x += sin( y * 7.0 ) * cos( z * 12.0 ) * 0.005;
	// 	pos.y += sin( x * 8.0 ) * cos( z * 13.0 ) * 0.005;
	// 	pos.z += sin( x * 9.0 ) * cos( y * 14.0 ) * 0.005;

	// }

	// pos.x = pos.x + .1;

	float x = pos.x + uTime;
	float y = pos.y;
	float z = pos.z;

	pos.x += sin( y * 7.0 ) * cos( z * 12.0 ) * 0.05;
	pos.y += sin( x * 8.0 ) * cos( z * 13.0 ) * 0.05;
	pos.z += sin( x * 9.0 ) * cos( y * 14.0 ) * 0.05;


	// Write new position out
	gl_FragColor = vec4(pos, 1.0);
	// gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
	// gl_FragColor = vec4(vUv, 0.0, 1.0);
}
