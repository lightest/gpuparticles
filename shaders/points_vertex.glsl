precision mediump float;

uniform sampler2D uParticlesOutput;
uniform vec3 uParticleStartColor;
uniform vec3 uParticleEndColor;
uniform vec3 uParticleTouchColor;

uniform float uSize;
uniform float uParticlesLifetime;
uniform vec3 uPointerPos;

varying vec4 vPosition;
varying vec3 vParticleColor;

bool isPerspectiveMatrix( mat4 m )
{
	return m[ 2 ][ 3 ] == - 1.0;
}

void main()
{
	vec4 data = texture2D(uParticlesOutput, position.xy);
	vec3 pos = data.xyz;

	vec4 modelPosition = modelMatrix * vec4(pos, 1.);
	vec3 displacementDir = normalize(modelPosition.xyz - uPointerPos);

	vec4 viewPosition = viewMatrix * modelPosition;
	vec4 projectedPosition = projectionMatrix * viewPosition;

	float lifeTime = data.w;
	vParticleColor = mix(uParticleStartColor, uParticleEndColor, lifeTime / uParticlesLifetime);

	// Raycaster driven color offset.
	// Sphere shape.
	// float l = 1.0f - clamp(length(uPointerPos - modelPosition.xyz), 0.0f, 1.0f);

	// Gaussian shape.
	float l = exp(-pow(length(uPointerPos - modelPosition.xyz), 2.0));
	vParticleColor = mix(vParticleColor, uParticleTouchColor, l);

	gl_PointSize = 20.0f;

	gl_Position = projectedPosition;
	if ( isPerspectiveMatrix( projectionMatrix ) ) gl_PointSize *= ( 1. / - viewPosition.z );

}
