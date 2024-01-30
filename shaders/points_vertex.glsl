uniform sampler2D uParticlesOutput;
uniform vec3 uPartcileStartColor;
uniform vec3 uPartcileEndColor;

uniform float uSize;
uniform float uTime;

varying vec2 vUv;
varying vec4 vPosition;
varying vec3 vParticleColor;

bool isPerspectiveMatrix( mat4 m )
{
	return m[ 2 ][ 3 ] == - 1.0;
}

void main()
{
	// vec3 color = texture2D( map, vUv ).rgb * 200.0 - 100.0;
	vec4 data = texture2D(uParticlesOutput, position.xy);
	vec3 pos = data.xyz;

	// pos += (sin(uTime * 2.) + 1.0) * normalize(pos);

	// float x = pos.x + uTime;
	// float y = pos.y;
	// float z = pos.z;

	// float A = .075;

	// pos.x += sin( y * 7.0 ) * cos( z * 12.0 ) * A;
	// pos.y += sin( x * 8.0 ) * cos( z * 13.0 ) * A;
	// pos.z += sin( x * 9.0 ) * cos( y * 14.0 ) * A;

	vec4 modelPosition = modelMatrix * vec4(pos, 1.);

	// float angle = atan(modelPosition.x, modelPosition.z);
	// float distanceToCenter = length(modelPosition.xyz);
	// float angleOffset = (1. / distanceToCenter) * uTime * .2;
	// angle += angleOffset;
	// modelPosition.x = cos(angle) * distanceToCenter;
	// modelPosition.z = sin(angle) * distanceToCenter;

	// modelPosition.xyz += aRand;

	vec4 viewPosition = viewMatrix * modelPosition;
	vec4 projectedPosition = projectionMatrix * viewPosition;

	// gl_Position = projectionMatrix * modelViewMatrix * vec4( color, 1.0 );
	// gl_Position = projectionMatrix * modelViewMatrix * vec4( position * 200.0, 1.0 );

	float lifeTime = data.w;

	// 1.5 is max life-itme, hard coded for now.
	vec3 color = mix(uPartcileStartColor, uPartcileEndColor, lifeTime / 1.5);
	vParticleColor = color;

	gl_PointSize = 1.0f;
	gl_Position = projectedPosition;
	// gl_PointSize = uSize * aScale;
	if ( isPerspectiveMatrix( projectionMatrix ) ) gl_PointSize *= ( 1. / - viewPosition.z );

}
