uniform sampler2D uParticlesPositions;

varying vec2 vUv;
varying vec4 vPosition;

void main()
{

	// float depth = smoothstep( 750.0, -500.0, gl_FragCoord.z / gl_FragCoord.w );
	// gl_FragColor = vec4( texture2D( map, vUv ).xyz, depth );
	gl_FragColor = vec4(1.0f, 0.0f, 0.0f, 1.0f);
}
