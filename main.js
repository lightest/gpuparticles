import "./style.css";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import * as THREE from "three";

let scene, camera, renderer;
let textures;
let materials;
let particlesComputeProgram;
let pointsRenderProgram;
let controls;
let simStep = 0;

async function loadShaders()
{
	let result = await fetch("./shaders/sim_vertex.glsl");
	const simVertex = await result.text();

	result = await fetch("./shaders/sim_fragment.glsl");
	const simFragment = await result.text();

	result = await fetch("./shaders/points_vertex.glsl");
	const pointsVertex = await result.text();

	result = await fetch("./shaders/points_fragment.glsl");
	const pointsFragment = await result.text();

	return {
		simVertex,
		simFragment,
		pointsVertex,
		pointsFragment
	};
}

function resampleToTorusKnot()
{
	// const geometry = new THREE.TorusKnotGeometry( 10, 3, 100, 16 );
	// const material = new THREE.MeshStandardMaterial( { color: 0xffffff } );
	// const torusKnot = new THREE.Mesh( geometry, material );

	const torusGeometry = new THREE.TorusKnotGeometry( 1, .25, 100, 16 );
	// const coneGeometry = new THREE.ConeGeometry( .5, 1, 32 );
	// const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
	const mesh = new THREE.Mesh(torusGeometry, material );

	// Create a sampler for a Mesh surface.
	const sampler = new MeshSurfaceSampler( mesh )
	.setWeightAttribute( 'color' )
	.build();

	var width = 512, height = 512;
	const position = new THREE.Vector3();
	const positions = geometry.attributes.position.array;

	for ( var i = 0, l = width * height; i < l; i++ )
	{
		const i3 = i * 3;
		sampler.sample(position);
		positions[i3] = position.x;
		positions[i3 + 1] = position.y;
		positions[i3 + 2] = position.z;
	}

	// geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	geometry.attributes.position.needsUpdate = true;
}
window.resampleToTorusKnot = resampleToTorusKnot;

function resampleToCone()
{
	// const geometry = new THREE.TorusKnotGeometry( 10, 3, 100, 16 );
	// const material = new THREE.MeshStandardMaterial( { color: 0xffffff } );
	// const torusKnot = new THREE.Mesh( geometry, material );

	// const torusGeometry = new THREE.TorusKnotGeometry( 1, .25, 100, 16 );
	const coneGeometry = new THREE.ConeGeometry( .5, 1, 32 );
	// const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
	const mesh = new THREE.Mesh(coneGeometry, material );

	// Create a sampler for a Mesh surface.
	const sampler = new MeshSurfaceSampler( mesh )
	.setWeightAttribute( 'color' )
	.build();

	var width = 512, height = 512;
	const position = new THREE.Vector3();
	const positions = geometry.attributes.position.array;

	for ( var i = 0, l = width * height; i < l; i++ )
	{
		const i3 = i * 3;
		sampler.sample(position);
		positions[i3] = position.x;
		positions[i3 + 1] = position.y;
		positions[i3 + 2] = position.z;
	}

	// geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	geometry.attributes.position.needsUpdate = true;
}
window.resampleToCone = resampleToCone;

function resampleToBox()
{
	// const geometry = new THREE.TorusKnotGeometry( 10, 3, 100, 16 );
	// const material = new THREE.MeshStandardMaterial( { color: 0xffffff } );
	// const torusKnot = new THREE.Mesh( geometry, material );

	// const torusGeometry = new THREE.TorusKnotGeometry( 1, .25, 100, 16 );
	// const coneGeometry = new THREE.ConeGeometry( .5, 1, 32 );
	const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
	const mesh = new THREE.Mesh(boxGeometry, material );

	// Create a sampler for a Mesh surface.
	const sampler = new MeshSurfaceSampler( mesh )
	.setWeightAttribute( 'color' )
	.build();

	var width = 512, height = 512;
	const position = new THREE.Vector3();
	const positions = geometry.attributes.position.array;

	for ( var i = 0, l = width * height; i < l; i++ )
	{
		const i3 = i * 3;
		sampler.sample(position);
		positions[i3] = position.x;
		positions[i3 + 1] = position.y;
		positions[i3 + 2] = position.z;
	}

	// geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	geometry.attributes.position.needsUpdate = true;
}
window.resampleToBox = resampleToBox;

function setupTextureResources(params)
{
	const { width, height } = params;
	const len = width * height;
	const data = new Float32Array(len * 4);

	for (let i = 0; i < len; i++)
	{
		const i4 = i * 3;
		data[i4] = Math.random() * 2 - 1     * 1;
		data[i4 + 1] = Math.random() * 2 - 1 * 1;
		data[i4 + 2] = Math.random() * 2 - 1 * 1;
	}

	const originalPositionDataTexture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
	originalPositionDataTexture.needsUpdate = true;

	const rtParams = {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType
	};

	const computeRenderTarget0 = new THREE.WebGLRenderTarget(width, height, rtParams);
	const computeRenderTarget1 = new THREE.WebGLRenderTarget(width, height, rtParams);

	return {
		originalPositionDataTexture,
		computeRenderTargets: [computeRenderTarget0, computeRenderTarget1]
	};
}

function setupShaderMaterials(shaders, textures)
{
	// This is analogy of compute shader which calculates positions of the particles
	// for the next simulation step, hence the name.
	const simShaderMaterial = new THREE.ShaderMaterial({
		vertexShader: shaders.simVertex,
		fragmentShader: shaders.simFragment,
		uniforms: {
			uTime: {
				value: 0
			},

			uParticlesOriginPosition:{
				type: "t",
				value: textures.originalPositionDataTexture
			},

			uParticlesPositions: {
				type: "t",
				value: textures.originalPositionDataTexture
			}
		}
	});

	// This one just takes positions calculated in the simulation and applies them
	// to vertices of THREE.Points mesh.
	const pointsRenderShaderMaterial = new THREE.ShaderMaterial({
		vertexShader: shaders.pointsVertex,
		fragmentShader: shaders.pointsFragment,
		uniforms: {
			uTime: { value: 0 },
			uParticlesOutput: {
				type: "t",
				value: null
			},
		}
	});

	return {
		simShaderMaterial,
		pointsRenderShaderMaterial
	};
}

function setupParticlesComputePorgram(pipelineParams = {})
{
	const { width, height, materials } = pipelineParams;
	const scene = new THREE.Scene();

	// TODO: why 2^53??
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1 / Math.pow(2, 53), 1);
	// const camera = new THREE.OrthographicCamera( width / - 2, width / 2, height / 2, height / - 2, 1, 1000 );

	const quadVertices = new Float32Array([
		-1, -1, 0,
		1, -1, 0,
		1, 1, 0,

		1, 1, 0,
		-1, 1, 0,
		-1, -1, 0,
	]);

	const quadUVs = new Float32Array([
		0, 0,
		1, 0,
		1, 1,

		1, 1,
		0, 1,
		0, 0
	]);

	const quadGeometry = new THREE.BufferGeometry();
	quadGeometry.setAttribute("position", new THREE.BufferAttribute(quadVertices, 3));
	quadGeometry.setAttribute("uv", new THREE.BufferAttribute(quadUVs, 2));
	const quadMesh = new THREE.Mesh(quadGeometry, materials.simShaderMaterial);

	scene.add(camera);
	scene.add(quadMesh);

	return {
		scene,
		camera
	};
}

function setupPointsRenderProgram(pipelineParams = {})
{
	const { width, height, materials } = pipelineParams;
	const pointsGeometry = new THREE.BufferGeometry();
	const positions = new Float32Array(width * height * 3);

	for (let i = 0, l = width * height; i < l; i++)
	{
		const i3 = i * 3;
		positions[i3] = ( i % width ) / width ;
		positions[i3 + 1] = ( i / width ) / height;
	}

	pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

	const pointsMesh = new THREE.Points(pointsGeometry, materials.pointsRenderShaderMaterial);

	return {
		pointsMesh
	};
}

function init(shaders)
{
	const canvas = document.querySelector("canvas");
	console.log(canvas);

	renderer = new THREE.WebGLRenderer(
	{
		canvas,
		antialias: false
	});

	renderer.setSize( window.innerWidth, window.innerHeight );
	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
	camera.position.x = 1
	camera.position.y = 1
	camera.position.z = 1
	scene.add(camera)

	controls = new OrbitControls( camera, canvas );
	controls.radius = 400;
	controls.speed = 3;

	var width = 256, height = 256;
	// var width = 64, height = 64;
	// var width = 128, height = 128;

	textures = setupTextureResources({ width, height });
	materials = setupShaderMaterials(shaders, textures);
	particlesComputeProgram = setupParticlesComputePorgram({ width, height, materials });
	pointsRenderProgram = setupPointsRenderProgram({ width, height, materials });

	scene.add( pointsRenderProgram.pointsMesh );
}

function animate()
{
	requestAnimationFrame( animate );
	render();
}

var timer = 0;

function render()
{
	timer += 0.01;
	controls.update();
	materials.simShaderMaterial.uniforms.uTime.value = timer;
	renderer.setRenderTarget(textures.computeRenderTargets[simStep]);
	renderer.render(particlesComputeProgram.scene, particlesComputeProgram.camera);
	// renderer.render(particlesComputeProgram.scene, camera);

	// materials.pointsRenderShaderMaterial.uniforms.uTime.value = timer;
	renderer.setRenderTarget(null);
	materials.pointsRenderShaderMaterial.uniforms.uParticlesOutput.value = textures.computeRenderTargets[simStep].texture;
	renderer.render( scene, camera );

	materials.simShaderMaterial.uniforms.uParticlesPositions.value = textures.computeRenderTargets[simStep].texture;
	simStep = (simStep + 1) % 2;
}

async function onLoad()
{
	const shaders = await loadShaders();
	init(shaders);
	animate();
}

window.onload = onLoad;
