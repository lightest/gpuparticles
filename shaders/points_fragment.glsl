precision mediump float;

uniform sampler2D uParticlesOutput;
uniform vec3 uPartcileStartColor;
uniform vec3 uPartcileEndColor;

varying vec4 vPosition;
varying vec3 vParticleColor;

float Star(vec2 uv, float flare) {
    float d = length(uv);
    float m = max(0.001, 0.05 / d);

    float rays = max(0., 1.-abs(uv.x*uv.y*1000.));
    m += rays*flare;
    // uv *= Rot(3.1415/4.);
    rays = max(0., 1.-abs(uv.x*uv.y*1000.));
    m += rays*.3*flare;

    m *= smoothstep(1., .2, d);
    return m;
}

void main()
{
	vec2 uv = gl_PointCoord;
	vec3 c = vec3(Star(uv * 2.0f - 1.0f, .5f)) * vParticleColor;
	c = pow(c, 1.0f / vec3(1.5f));
	gl_FragColor = vec4(c, 1.0f);
}
