uniform sampler2D uParticlesOutput;

uniform float width;
uniform float height;

uniform float uSize;
uniform float uTime;

varying vec2 vUv;
varying vec4 vPosition;

bool isPerspectiveMatrix( mat4 m )
{
	return m[ 2 ][ 3 ] == - 1.0;
}

void main() {
	// vUv = position.xy + vec2( 0.5 / width, 0.5 / height );

	// vec3 color = texture2D( map, vUv ).rgb * 200.0 - 100.0;
	// vec3 pos = position;
	vec3 pos = texture2D(uParticlesOutput, position.xy).xyz;

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

	gl_PointSize = 1.0f;
	gl_Position = projectedPosition;
	// gl_PointSize = uSize * aScale;
	if ( isPerspectiveMatrix( projectionMatrix ) ) gl_PointSize *= ( 1. / - viewPosition.z );

}
