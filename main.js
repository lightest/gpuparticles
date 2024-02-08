import "./style.css";
import * as dat from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

window.THREE = THREE;

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
	particleEndColor: 0x6bdef5,
	particleLifetime: 1.5,
	spawnPointMix: 0
};

gui.add(debugObject, "particleLifetime", .01, 7).onChange((v) => {
	materials.simShaderMaterial.uniforms.uParticlesLifetime.value = v;
	materials.pointsRenderShaderMaterial.uniforms.uParticlesLifetime.value = v;
});

gui.add(debugObject, "spawnPointMix", 0, 1, .001).onChange((v) => {
	materials.simShaderMaterial.uniforms.uOriginPointMix.value = v;
});

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

	// TODO: ensure this works for .glbs
	if (!(mesh.material instanceof THREE.MeshBasicMaterial))
	{
		const material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
		mesh.material = material;
	}

	// Create a sampler for a Mesh surface.
	const sampler = new MeshSurfaceSampler( mesh )
	.setWeightAttribute( 'color' )
	.build();

	// Uncomment desired data samples.
	const position = new THREE.Vector3();
	const normal = new THREE.Vector3();
	// const color = new THREE.Vector3();
	// const uv = new THREE.Vector3();

	// Positions and life-time.
	const surfacePoints = new Float32Array(width * height * 4);
	const surfaceNormals = new Float32Array(width * height * 4);

	for (i = 0, l = width * height; i < l; i++ )
	{
		const i4 = i * 4;
		sampler.sample(position, normal);
		surfacePoints[i4] = position.x;
		surfacePoints[i4 + 1] = position.y;
		surfacePoints[i4 + 2] = position.z;

		// Initial life-time.
		surfacePoints[i4 + 3] = Math.random();

		surfaceNormals[i4] = normal.x;
		surfaceNormals[i4 + 1] = normal.y;
		surfaceNormals[i4 + 2] = normal.z;
	}

	return {
		surfacePoints,
		surfaceNormals
	};
}

function resampleToTorusKnot(width, height)
{
	let i, l;
	const torusGeometry = new THREE.TorusKnotGeometry( 1, .25, 100, 16 );
	const material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
	const mesh = new THREE.Mesh(torusGeometry, material);

	return sampleMeshSurface(width, height, mesh);
}
window.resampleToTorusKnot = resampleToTorusKnot;

function resampleToCone(width, height)
{
	let i, l;
	const coneGeometry = new THREE.ConeGeometry( .5, 1, 32 );
	const material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
	const mesh = new THREE.Mesh(coneGeometry, material );

	return sampleMeshSurface(width, height, mesh);
}
window.resampleToCone = resampleToCone;

function resampleToBox(width, height)
{
	let i, l;
	const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
	const mesh = new THREE.Mesh(boxGeometry, material );

	return sampleMeshSurface(width, height, mesh);
}
window.resampleToBox = resampleToBox;

function glbToMeshSurfacePoints(glbModel)
{
	const width = 512;
	const height = 512;
	const mesh = glbModel.scene.children.find(child => child instanceof THREE.Mesh);
	const data = sampleMeshSurface(width, height, mesh);

	const originalPositionsDataTexture = new THREE.DataTexture(data.surfacePoints, width, height, THREE.RGBAFormat, THREE.FloatType);
	// const originalNormalsDataTexture = new THREE.DataTexture(data.surfaceNormals, width, height, THREE.RGBAFormat, THREE.FloatType);
	const originalNormalsDataTexture = new THREE.DataTexture(
		data.surfaceNormals, width, height, THREE.RGBAFormat, THREE.FloatType,
		undefined,
		undefined,
		undefined,
		THREE.LinearFilter,
		THREE.LinearFilter
	);
	originalPositionsDataTexture.needsUpdate = true;
	originalNormalsDataTexture.needsUpdate = true;

	materials.simShaderMaterial.uniforms.uParticlesOriginPosition.value = originalPositionsDataTexture;
	materials.simShaderMaterial.uniforms.uParticlesOriginNormal.value = originalNormalsDataTexture;
}

function setupTextureResources(params)
{
	const { width, height } = params;
	const len = width * height;
	let data = params.data;
	let altData = params.altData;

	if (!data)
	{
		data = resampleToBox(width, height);
	}

	if (!altData)
	{
		altData = resampleToTorusKnot(width, height);
	}

	const originalPositionDataTexture = new THREE.DataTexture(data.surfacePoints, width, height, THREE.RGBAFormat, THREE.FloatType);
	const originalNormalsDataTexture = new THREE.DataTexture(
		data.surfaceNormals, width, height, THREE.RGBAFormat, THREE.FloatType,
		undefined,
		undefined,
		undefined,
		THREE.LinearFilter,
		THREE.LinearMipmapLinearFilter
	);
	originalPositionDataTexture.needsUpdate = true;
	originalNormalsDataTexture.needsUpdate = true;

	const originalPositionDataTextureAlt = new THREE.DataTexture(altData.surfacePoints, width, height, THREE.RGBAFormat, THREE.FloatType);
	const originalNormalsDataTextureAlt = new THREE.DataTexture(
		altData.surfaceNormals, width, height, THREE.RGBAFormat, THREE.FloatType,
		undefined,
		undefined,
		undefined,
		THREE.LinearFilter,
		THREE.LinearMipmapLinearFilter
	);
	originalPositionDataTextureAlt.needsUpdate = true;
	originalNormalsDataTextureAlt.needsUpdate = true;

	// NOTE! type can be both THREE.FloatType and THREE.HalfFloatType for compute render targets.
	// HalfFloat uses 16-bit floating point textures which in some cases allows to achieve faster performance.
	const rtParams = {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.HalfFloatType
	};

	const computeRenderTarget0 = new THREE.WebGLRenderTarget(width, height, rtParams);
	const computeRenderTarget1 = new THREE.WebGLRenderTarget(width, height, rtParams);

	return {
		originalPositionDataTexture,
		originalNormalsDataTexture,
		originalPositionDataTextureAlt,
		originalNormalsDataTextureAlt,
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

			uParticlesLifetime: {
				value: debugObject.particleLifetime
			},

			uOriginPointMix: {
				value: debugObject.spawnPointMix
			},

			uParticlesOriginPosition: {
				type: "t",
				value: textures.originalPositionDataTexture
			},

			uParticlesOriginNormal: {
				type: "t",
				value: textures.originalNormalsDataTexture
			},

			uParticlesOriginPositionAlt: {
				type: "t",
				value: textures.originalPositionDataTextureAlt
			},

			uParticlesOriginNormalAlt: {
				value: "t",
				value: textures.originalNormalsDataTextureAlt
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

			uParticlesLifetime: {
				value: debugObject.particleLifetime
			},

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

function handleWindowResize(e)
{
	// Update camera
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	// Update renderer
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function addEventListeners()
{
	const canvas = document.querySelector("canvas");
	canvas.addEventListener('drop', handleFileDrop);
	canvas.addEventListener('dragover', e => e.preventDefault());
	window.addEventListener('resize', handleWindowResize);
}

async function onLoad()
{
	const shaders = await loadShaders();
	init(shaders);
	addEventListeners();
	animate();
}

window.onload = onLoad;
