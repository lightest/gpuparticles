uniform sampler2D uParticlesOutput;
uniform vec3 uPartcileStartColor;
uniform vec3 uPartcileEndColor;

varying vec2 vUv;
varying vec4 vPosition;
varying vec3 vParticleColor;

void main()
{
	// float depth = smoothstep( 750.0, -500.0, gl_FragCoord.z / gl_FragCoord.w );
	// gl_FragColor = vec4( texture2D( map, vUv ).xyz, depth );
	gl_FragColor = vec4(vParticleColor, 1.0f);
}
