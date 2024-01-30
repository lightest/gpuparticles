import "./style.css";
import * as dat from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

let scene, camera, renderer;
let textures;
let materials;
let particlesComputeProgram;
let pointsRenderProgram;
let controls;
let simStep = 0;
const clock = new THREE.Clock();
let prevFrameTime = clock.getElapsedTime();

const gui = new dat.GUI({ width: 400 });
const debugObject = {
	particleStartColor: 0x8c2eff,
	particleEndColor: 0x6bdef5
};

gui.addColor(debugObject, "particleStartColor").onChange(() =>
{
	materials.pointsRenderShaderMaterial.uniforms.uPartcileStartColor.value.set(debugObject.particleStartColor);
});

gui.addColor(debugObject, "particleEndColor").onChange(() =>
{
	materials.pointsRenderShaderMaterial.uniforms.uPartcileEndColor.value.set(debugObject.particleEndColor);
});

/**
 * Loaders
 */
// Texture loader
const textureLoader = new THREE.TextureLoader();

// Draco loader
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('draco/');

// GLTF loader
const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader);

// gltfLoader.load("models/monkey.glb", (glbModel) =>
// {
// 	const mesh = glbModel.scene.children.find(child => child instanceof THREE.Mesh);
// 	console.log(mesh);
// 	const data = sampleMeshSurface(512, 512, mesh);
// 	console.log(data);
// 	const originalPositionDataTexture = new THREE.DataTexture(data, 512, 512, THREE.RGBAFormat, THREE.FloatType);
// 	originalPositionDataTexture.needsUpdate = true;
// 	materials.simShaderMaterial.uniforms.uParticlesOriginPosition.value = originalPositionDataTexture;
// });

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

function sampleMeshSurface(width, height, mesh)
{
	if (!mesh)
	{
		console.error("Mesh is undefined!");
		return;
	}

	let i, l;
	const material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
	mesh.material = material;

	// Create a sampler for a Mesh surface.
	const sampler = new MeshSurfaceSampler( mesh )
	.setWeightAttribute( 'color' )
	.build();

	const position = new THREE.Vector3();

	// Positions and life-time.
	const data = new Float32Array(width * height * 4);

	for (i = 0, l = width * height; i < l; i++ )
	{
		const i4 = i * 4;
		sampler.sample(position);
		data[i4] = position.x;
		data[i4 + 1] = position.y;
		data[i4 + 2] = position.z;

		// Initial life-time.
		data[i4 + 3] = Math.random();
	}

	return data;
}

function resampleToTorusKnot(width, height)
{
	let i, l;
	const torusGeometry = new THREE.TorusKnotGeometry( 1, .25, 100, 16 );
	const material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
	const mesh = new THREE.Mesh(torusGeometry, material );

	console.log(torusGeometry.attributes);

	// Create a sampler for a Mesh surface.
	const sampler = new MeshSurfaceSampler( mesh )
	.setWeightAttribute( 'color' )
	.build();

	const position = new THREE.Vector3();

	// Positions and life-time.
	const data = new Float32Array(width * height * 4);

	for (i = 0, l = width * height; i < l; i++ )
	{
		const i4 = i * 4;
		sampler.sample(position);
		data[i4] = position.x;
		data[i4 + 1] = position.y;
		data[i4 + 2] = position.z;

		// Initial life-time.
		data[i4 + 3] = Math.random();
	}

	return data;
}
window.resampleToTorusKnot = resampleToTorusKnot;

function resampleToCone(width, height)
{
	let i, l;
	const coneGeometry = new THREE.ConeGeometry( .5, 1, 32 );
	const material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
	const mesh = new THREE.Mesh(coneGeometry, material );

	// Create a sampler for a Mesh surface.
	const sampler = new MeshSurfaceSampler( mesh )
	.setWeightAttribute( 'color' )
	.build();

	const position = new THREE.Vector3();

	// Positions and life-time.
	const data = new Float32Array(width * height * 4);

	for (i = 0, l = width * height; i < l; i++ )
	{
		const i4 = i * 4;
		sampler.sample(position);
		data[i4] = position.x;
		data[i4 + 1] = position.y;
		data[i4 + 2] = position.z;

		// Initial life-time.
		data[i4 + 3] = Math.random();
	}

	return data;
}
window.resampleToCone = resampleToCone;

function resampleToBox(width, height)
{
	let i, l;
	const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
	const mesh = new THREE.Mesh(boxGeometry, material );

	// Create a sampler for a Mesh surface.
	const sampler = new MeshSurfaceSampler( mesh )
	.setWeightAttribute( 'color' )
	.build();

	const position = new THREE.Vector3();

	// Positions and life-time.
	const data = new Float32Array(width * height * 4);

	for (i = 0, l = width * height; i < l; i++ )
	{
		const i4 = i * 4;
		sampler.sample(position);
		data[i4] = position.x;
		data[i4 + 1] = position.y;
		data[i4 + 2] = position.z;

		// Initial life-time.
		data[i4 + 3] = Math.random();
	}

	return data;
}
window.resampleToBox = resampleToBox;

function glbToMeshSurfacePoints(glbModel)
{
	const width = 512;
	const height = 512;
	const mesh = glbModel.scene.children.find(child => child instanceof THREE.Mesh);
	const data = sampleMeshSurface(width, height, mesh);
	const originalPositionDataTexture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
	originalPositionDataTexture.needsUpdate = true;
	materials.simShaderMaterial.uniforms.uParticlesOriginPosition.value = originalPositionDataTexture;
}

function setupTextureResources(params)
{
	const { width, height } = params;
	const len = width * height;
	let data = params.data;

	if (!data)
	{
		data = new Float32Array(len * 4);

		for (let i = 0; i < len; i++)
		{
			const i4 = i * 3;
			data[i4] = Math.random() * 2 - 1     * 1;
			data[i4 + 1] = Math.random() * 2 - 1 * 1;
			data[i4 + 2] = Math.random() * 2 - 1 * 1;
		}
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

			uDt: {
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

			uPartcileStartColor: {
				value: new THREE.Color(debugObject.particleStartColor)
			},

			uPartcileEndColor: {
				value: new THREE.Color(debugObject.particleEndColor)
			},

			uParticlesOutput: {
				type: "t",
				value: null
			},
		},
		blending: THREE.AdditiveBlending,
		transparent: true,
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
	// camera.position.x = 1
	// camera.position.y = 1
	camera.position.z = 1
	scene.add(camera)

	controls = new OrbitControls( camera, canvas );
	controls.radius = 400;
	controls.speed = 3;

	var width = 512, height = 512;
	// var width = 64, height = 64;
	// var width = 128, height = 128;

	// const data = resampleToTorusKnot(width, height);
	// const data = resampleToCone(width, height);
	const data = resampleToBox(width, height);
	textures = setupTextureResources({ width, height, data });
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

function render()
{
	const elapsedTime = clock.getElapsedTime();
	const dt = elapsedTime - prevFrameTime;
	controls.update();
	materials.simShaderMaterial.uniforms.uTime.value = elapsedTime;
	materials.simShaderMaterial.uniforms.uDt.value = dt;
	renderer.setRenderTarget(textures.computeRenderTargets[simStep]);
	renderer.render(particlesComputeProgram.scene, particlesComputeProgram.camera);
	// renderer.render(particlesComputeProgram.scene, camera);

	// materials.pointsRenderShaderMaterial.uniforms.uTime.value = elapsedTime;
	renderer.setRenderTarget(null);
	materials.pointsRenderShaderMaterial.uniforms.uParticlesOutput.value = textures.computeRenderTargets[simStep].texture;
	renderer.render( scene, camera );

	materials.simShaderMaterial.uniforms.uParticlesPositions.value = textures.computeRenderTargets[simStep].texture;
	simStep = (simStep + 1) % 2;
	prevFrameTime = elapsedTime;
}

function handleFileDrop(e)
{
	e.preventDefault();
	const r = new FileReader();
	r.onload = function (readRes) {
		console.log(readRes);
		gltfLoader.parse(readRes.target.result, "", (result) => {
			console.log(result);
			glbToMeshSurfacePoints(result);
		});
	};
	r.readAsArrayBuffer(e.dataTransfer.files[0]);
}

function addEventListeners()
{
	const canvas = document.querySelector("canvas");
	canvas.addEventListener('drop', handleFileDrop);
	canvas.addEventListener('dragover', e => e.preventDefault());
}

async function onLoad()
{
	const shaders = await loadShaders();
	init(shaders);
	addEventListeners();
	animate();
}

window.onload = onLoad;
