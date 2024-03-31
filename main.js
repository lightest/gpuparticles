import "./style.css";
import * as dat from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const isMobile = /iPhone|iPad|iPod|Android|BlackBerry|Windows Phone/i.test(navigator.userAgent);

// Load assets.
const modelAssets = [
    "models/rocket1v2.glb",
    "models/earth.glb",
];
const loadedGlbs = [];
let SIM_WIDTH = 512;
let SIM_HEIGHT = 512;
let scene, camera, renderer;
let textures;
let materials;
let particlesComputeProgram;
let pointsRenderProgram;
let controls;
let simStep = 0;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
let currentMesh = undefined;
let primaryMesh = undefined;
let secondaryMesh = undefined;
const meshes = [primaryMesh, secondaryMesh];
const cursor3D = new THREE.Vector3();
const targetCursor3D = new THREE.Vector3();
const cursor3DVec4 = new THREE.Vector4();
const cursor3DVec3Sim = new THREE.Vector3();
const inverseMeshWorldMatrix = new THREE.Matrix4();

// For computational purposes.
const rayOrigin = new THREE.Vector3();
const rayDir = new THREE.Vector3();

let prevFrameTime = clock.getElapsedTime();

let gParticlesMaterial;
let gPointsMesh;

const gui = new dat.GUI({ width: 400 });

const particlesDebugObject = {
    particleStartColor: isMobile ? 0x401871 : 0x3c355f,
    particleEndColor: isMobile ? 0x2C565E : 0x343555,
    particleTouchColor: 0xa46652,
    particleLifetime: 0.95064,
    spawnPointMix: 0,
    pointerDisplacementMag: 0.065,
    noiseScale: 1.3,
    noiseMagnitude: .005,
    modelPositionX: 0,
    modelPositionY: 0,
    modelPositionZ: 0,
    modelScale: 0.675,
    modelRotationX: 0,
    modelRotationY: 0,
    modelRotationZ: 0,
};

const particlesgui = gui.addFolder("particles");

particlesgui.add(particlesDebugObject, "particleLifetime", .01, 7).onChange((v) => {
    gParticlesMaterial.simShaderMaterial.uniforms.uParticlesLifetime.value = v;
    gParticlesMaterial.pointsRenderShaderMaterial.uniforms.uParticlesLifetime.value = v;
});

particlesgui.add(particlesDebugObject, "spawnPointMix", 0, 1, .001).onChange((v) => {
    gParticlesMaterial.simShaderMaterial.uniforms.uOriginPointMix.value = v;
});

particlesgui.add(particlesDebugObject, "pointerDisplacementMag", 0, 1, .001).onChange((v) => {
    gParticlesMaterial.simShaderMaterial.uniforms.uPointerDisplacementMagnitude.value = v;
});

particlesgui.add(particlesDebugObject, "noiseScale", 0, 10, .1).onChange((v) => {
    gParticlesMaterial.simShaderMaterial.uniforms.uNoiseScale.value = v;
});

particlesgui.add(particlesDebugObject, "noiseMagnitude", 0, .5, .001).onChange((v) => {
    gParticlesMaterial.simShaderMaterial.uniforms.uNoiseMagnitude.value = v;
});

particlesgui.addColor(particlesDebugObject, "particleStartColor").onChange(() => {
    gParticlesMaterial.pointsRenderShaderMaterial.uniforms.uParticleStartColor.value.set(
        particlesDebugObject.particleStartColor
    );
});

particlesgui.addColor(particlesDebugObject, "particleEndColor").onChange(() => {
    gParticlesMaterial.pointsRenderShaderMaterial.uniforms.uParticleEndColor.value.set(
        particlesDebugObject.particleEndColor
    );
});

particlesgui.addColor(particlesDebugObject, "particleTouchColor").onChange(() => {
    gParticlesMaterial.pointsRenderShaderMaterial.uniforms.uParticleTouchColor.value.set(
        particlesDebugObject.particleTouchColor
    );
});

particlesgui.add(particlesDebugObject, "modelScale", 0, 10, .001).onChange((v) => {
    gPointsMesh.scale.set(v, v, v);
});

particlesgui.add(particlesDebugObject, "modelPositionX", -10, 10, .001).onChange((v) => {
    gPointsMesh.position.setX(v);
});

particlesgui.add(particlesDebugObject, "modelPositionY", -10, 10, .001).onChange((v) => {
    gPointsMesh.position.setY(v);
});

particlesgui.add(particlesDebugObject, "modelPositionZ", -1, 10, .001).onChange((v) => {
    gPointsMesh.position.setZ(v);
});

particlesgui.add(particlesDebugObject, "modelRotationX", -Math.PI, Math.PI, .001).onChange((v) => {
    gPointsMesh.rotation.x = v;
});

particlesgui.add(particlesDebugObject, "modelRotationY", -Math.PI, Math.PI, .001).onChange((v) => {
    gPointsMesh.rotation.y = v;
});

particlesgui.add(particlesDebugObject, "modelRotationZ", -Math.PI, Math.PI, .001).onChange((v) => {
    gPointsMesh.rotation.z = v;
});

/**
 * Loaders
 */
// Texture loader
const textureLoader = new THREE.TextureLoader();

// Draco loader
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("draco/");

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

function sampleMeshSurface(width, height, mesh) {
    if (!mesh) {
        console.error("Mesh is undefined!");
        return;
    }

    let i, l;

    // TODO: ensure this works for .glbs
    if (!(mesh.material instanceof THREE.MeshBasicMaterial)) {
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        mesh.material = material;
    }

    // Create a sampler for a Mesh surface.
    const sampler = new MeshSurfaceSampler(mesh)
        .setWeightAttribute("color")
        .build();

    // Uncomment desired data samples.
    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    // const color = new THREE.Vector3();
    // const uv = new THREE.Vector3();

    // Positions and life-time.
    const surfacePoints = new Float32Array(width * height * 4);
    const surfaceNormals = new Float32Array(width * height * 4);

    for (i = 0, l = width * height; i < l; i++) {
        const i4 = i * 4;
        sampler.sample(
            position,
            normal,
            // color,
            // uv
        );
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

function glbToMeshSurfacePoints(glbModel) {
    const width = SIM_WIDTH;
    const height = SIM_HEIGHT;
    const mesh = glbModel.scene.children.find(child => child instanceof THREE.Mesh);
    const data = sampleMeshSurface(width, height, mesh);

    const originalPositionsDataTexture = new THREE.DataTexture(data.surfacePoints, width, height, THREE.RGBAFormat, THREE.FloatType);
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

    return {
        mesh,
        originalPositionsDataTexture,
        originalNormalsDataTexture
    };
}

function setupTextureResources(params) {
    const { width, height } = params;

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
        computeRenderTargets: [computeRenderTarget0, computeRenderTarget1]
    };
}

function setupShaderMaterials(shaders, textures) {
    // This is analogy of compute shader which calculates positions of the particles
    // for the next simulation step, hence the name.
    const simShaderMaterial = new THREE.ShaderMaterial({
        vertexShader: shaders.simVertex,
        fragmentShader: shaders.simFragment,
        uniforms: {
            uTime: {
                value: 0
            },

            uPointerPos: {
                value: new THREE.Vector3(0)
            },

            uDt: {
                value: 0
            },

            uParticlesLifetime: {
                value: 1
            },

            uNoiseScale: {
                value: 1
            },

            uNoiseMagnitude: {
                value: 1
            },

            uPointerDisplacementMagnitude: {
                value: 1
            },

            uOriginPointMix: {
                value: 0
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
                type: "t",
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

            uPointerPos: {
                value: new THREE.Vector3(0)
            },

            uParticlesLifetime: {
                value: 1
            },

            uParticleStartColor: {
                value: new THREE.Color(0x8c2eff)
            },

            uParticleEndColor: {
                value: new THREE.Color(0x6bdef5)
            },

            uParticleTouchColor: {
                value: new THREE.Color(0xff0000)
            },

            uParticlesOutput: {
                type: "t",
                value: null
            },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
    });

    return {
        simShaderMaterial,
        pointsRenderShaderMaterial
    };
}

function setupParticlesComputePorgram(pipelineParams = {}) {
    const { materials } = pipelineParams;
    const scene = new THREE.Scene();

    // TODO: why 2^53??
    const camera = new THREE.OrthographicCamera(
        -1,
        1,
        1,
        -1,
        1 / Math.pow(2, 53),
        1
    );
    // const camera = new THREE.OrthographicCamera( width / - 2, width / 2, height / 2, height / - 2, 1, 1000 );

    const quadVertices = new Float32Array([
        -1, -1, 0, 1, -1, 0, 1, 1, 0,

        1, 1, 0, -1, 1, 0, -1, -1, 0,
    ]);

    const quadUVs = new Float32Array([
        0, 0, 1, 0, 1, 1,

        1, 1, 0, 1, 0, 0,
    ]);

    const quadGeometry = new THREE.BufferGeometry();
    quadGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(quadVertices, 3)
    );
    quadGeometry.setAttribute("uv", new THREE.BufferAttribute(quadUVs, 2));
    const quadMesh = new THREE.Mesh(quadGeometry, materials.simShaderMaterial);

    scene.add(camera);
    scene.add(quadMesh);

    return {
        scene,
        camera,
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
        positions[i3] = (i % width) / width;
        positions[i3 + 1] = i / width / height;
    }

    pointsGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
    );

    const pointsMesh = new THREE.Points(
        pointsGeometry,
        materials.pointsRenderShaderMaterial
    );

    return {
        pointsMesh,
    };
}

function setParticlesMeshAndData(glbModel, meshIndex = 0)
{
    const {
        mesh,
        originalPositionsDataTexture,
        originalNormalsDataTexture
    } = glbToMeshSurfacePoints(glbModel);

    if (meshIndex === 0)
    {
        if (primaryMesh)
        {
            if (currentMesh === primaryMesh)
            {
                currentMesh = mesh;
            }

            scene.remove(primaryMesh);
            primaryMesh.material.dispose();
            primaryMesh.geometry.dispose();
        }

        primaryMesh = mesh;
        primaryMesh.visible = false;
        scene.add(primaryMesh);

        meshes[meshIndex] = primaryMesh;

        materials.simShaderMaterial.uniforms.uParticlesPositions.value = originalPositionsDataTexture;
        materials.simShaderMaterial.uniforms.uParticlesOriginPosition.value = originalPositionsDataTexture;
        materials.simShaderMaterial.uniforms.uParticlesOriginNormal.value = originalNormalsDataTexture;
    }
    else
    {
        if (secondaryMesh)
        {
            if (currentMesh === secondaryMesh)
            {
                currentMesh = mesh;
            }

            scene.remove(secondaryMesh);
            secondaryMesh.material.dispose();
            secondaryMesh.geometry.dispose();
        }

        secondaryMesh = mesh;
        secondaryMesh.visible = false;
        scene.add(secondaryMesh);

        meshes[meshIndex] = secondaryMesh;

        materials.simShaderMaterial.uniforms.uParticlesOriginPositionAlt.value = originalPositionsDataTexture;
        materials.simShaderMaterial.uniforms.uParticlesOriginNormalAlt.value = originalNormalsDataTexture;
    }
}

export function setParticlesMesh(params)
{
    let loadingPromiseResolve = () => {};
    const loadPromise = new Promise((res, rej) => { loadingPromiseResolve = res; });

    if (params.modelPath)
    {
        gltfLoader.load(params.modelPath, (glbModel) => {
            setParticlesMeshAndData(glbModel, params.meshIndex);
            loadingPromiseResolve();
        });
    }
    else if (params.glb)
    {
        setParticlesMeshAndData(params.glb, params.meshIndex);
        loadingPromiseResolve();
    }
    else
    {
        loadingPromiseResolve();
    }

    return loadPromise;
}

async function init(threeParams = {}, simParams = {})
{
    const shaders = await loadShaders();

    scene = threeParams.scene;
    camera = threeParams.camera;
    renderer = threeParams.renderer;

    const { width, height } = simParams;
    SIM_WIDTH = width;
    SIM_HEIGHT = height;

    const canvas = renderer.domElement;
    controls = new OrbitControls(camera, canvas);

    textures = setupTextureResources({ width, height });
    materials = setupShaderMaterials(shaders, textures);
    particlesComputeProgram = setupParticlesComputePorgram({
        width,
        height,
        materials,
    });
    pointsRenderProgram = setupPointsRenderProgram({ width, height, materials });

    if (simParams.glbModels)
    {
        // TODO: this should be able to handle more than two models.
        setParticlesMesh({ glb: simParams.glbModels[0], meshIndex: 0 });
        setParticlesMesh({ glb: simParams.glbModels[1], meshIndex: 1 });
    }

    return {
        pointsMesh: pointsRenderProgram.pointsMesh,
        particlesComputeProgram,
        pointsRenderProgram,
        materials
    };
}

function updateRaycaster()
{
    if (currentMesh)
    {
        currentMesh.position.copy(pointsRenderProgram.pointsMesh.position);
        currentMesh.rotation.copy(pointsRenderProgram.pointsMesh.rotation);
        currentMesh.scale.copy(pointsRenderProgram.pointsMesh.scale);
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObject(currentMesh);

        if (intersects.length > 0)
        {
            targetCursor3D.copy(intersects[0].point);
        }
        else
        {
            const currentIntersection = materials.pointsRenderShaderMaterial.uniforms.uPointerPos.value;
            rayOrigin.copy(raycaster.ray.origin);
            rayDir.copy(raycaster.ray.direction);
            const dist = camera.position.distanceTo(currentIntersection);
            rayDir.multiplyScalar(dist);
            rayOrigin.add(rayDir);
            targetCursor3D.set(rayOrigin.x, rayOrigin.y, rayOrigin.z);
        }

        materials.pointsRenderShaderMaterial.uniforms.uPointerPos.value = cursor3D;

        // Convert cursor corrdinates to the particle's local space.
        cursor3DVec4.set(cursor3D.x, cursor3D.y, cursor3D.z, 1.0);
        inverseMeshWorldMatrix.copy(currentMesh.matrixWorld);
        inverseMeshWorldMatrix.invert();
        cursor3DVec4.applyMatrix4(inverseMeshWorldMatrix);
        cursor3DVec3Sim.set(cursor3DVec4.x, cursor3DVec4.y, cursor3DVec4.z);
        materials.simShaderMaterial.uniforms.uPointerPos.value = cursor3DVec3Sim;
    }
}

function update()
{
    const elapsedTime = clock.getElapsedTime();
    const dt = elapsedTime - prevFrameTime;

    currentMesh = meshes[Math.round(particlesDebugObject.spawnPointMix)] || meshes[0];

    controls.update();
    updateRaycaster();
    materials.simShaderMaterial.uniforms.uTime.value = elapsedTime;
    materials.simShaderMaterial.uniforms.uDt.value = dt;
    renderer.setRenderTarget(textures.computeRenderTargets[simStep]);
    renderer.render(
        particlesComputeProgram.scene,
        particlesComputeProgram.camera
    );
    // renderer.render(particlesComputeProgram.scene, camera);

    // materials.pointsRenderShaderMaterial.uniforms.uTime.value = elapsedTime;
    renderer.setRenderTarget(null);
    materials.pointsRenderShaderMaterial.uniforms.uParticlesOutput.value =
        textures.computeRenderTargets[simStep].texture;

    materials.simShaderMaterial.uniforms.uParticlesPositions.value =
        textures.computeRenderTargets[simStep].texture;
    simStep = (simStep + 1) % 2;
    prevFrameTime = elapsedTime;

    animate3DCursor();

    // Constantly rotate the model
    pointsRenderProgram.pointsMesh.rotation.y += 0.003;
}

function animate3DCursor()
{
    const lerp = THREE.MathUtils.lerp;
    const lerp_speed = 0.1;

    const nX = lerp(cursor3D.x, targetCursor3D.x, lerp_speed);
    const nY = lerp(cursor3D.y, targetCursor3D.y, lerp_speed);
    const nZ = lerp(cursor3D.z, targetCursor3D.z, lerp_speed);

    cursor3D.set(nX, nY, nZ);
}

function handleFileDrop(e)
{
    e.preventDefault();
    e.stopPropagation();

    if (!(e.dataTransfer.files[0] instanceof Blob)) {
        return;
    }

    const r = new FileReader();
    r.onload = function (readRes) {
        console.log(readRes);
        gltfLoader.parse(readRes.target.result, null, (result) => {
            console.log(result);

            const {
                mesh,
                originalPositionsDataTexture,
                originalNormalsDataTexture
            } = glbToMeshSurfacePoints(result);

            currentMesh = mesh;
            mesh.visible = false;
            scene.add(mesh);

            materials.simShaderMaterial.uniforms.uParticlesOriginPosition.value = originalPositionsDataTexture;
            materials.simShaderMaterial.uniforms.uParticlesOriginNormal.value = originalNormalsDataTexture;
        });
    };
    r.readAsArrayBuffer(e.dataTransfer.files[0]);
}

function handlePointermove(e)
{
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = - (e.clientY / window.innerHeight) * 2 + 1;
}

function handleTouchmove(e)
{
    pointer.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
    pointer.y = - (e.touches[0].clientY / window.innerHeight) * 2 + 1;
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
    window.addEventListener("drop", handleFileDrop);
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("resize", handleWindowResize);

    if (isMobile)
    {
        // Using touchmove, due to pointermove being cancelled on scroll for mobiles.
        // Better ideas welcomed!
        window.addEventListener("touchmove", handleTouchmove);
    }
    else
    {
        window.addEventListener("pointermove", handlePointermove);
    }
}

function loadModelAssets()
{
    const loadingPromises = [];

    const loadModel = (i) =>
    {
        let resolver;

        const p = new Promise((res, rej) =>
        {
            resolver = res;
        });

        // Setting promises and glbs using index to ensure correctness of models order.
        // In this case order is going to match modelAssets list.
        loadingPromises[i] = p;

        gltfLoader.load(modelAssets[i], (glbModel) =>
        {
            loadedGlbs[i] = glbModel;
            resolver();
        });
    }

    for (let i = 0; i < modelAssets.length; i++)
    {
        loadModel(i);
    }

    return loadingPromises;
}

function animate()
{
	requestAnimationFrame(animate);
    update();

    // Render the scene
    renderer.render(scene, camera);
}

async function onLoad()
{
	await Promise.all(loadModelAssets());

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    const renderer = new THREE.WebGLRenderer({
    	canvas: document.querySelector("canvas")
    });
    renderer.setSize( window.innerWidth, window.innerHeight );
    camera.position.setZ(5);

	const { pointsMesh, materials } = await init(
		{
            scene,
            camera,
            renderer,
        },
        {
            width: 512,
            height: 512,
            glbModels: loadedGlbs
        }
	);

	materials.simShaderMaterial.uniforms.uParticlesLifetime.value = particlesDebugObject.particleLifetime;
    materials.pointsRenderShaderMaterial.uniforms.uParticlesLifetime.value = particlesDebugObject.particleLifetime;
    materials.simShaderMaterial.uniforms.uNoiseScale.value = particlesDebugObject.noiseScale;
    materials.simShaderMaterial.uniforms.uNoiseMagnitude.value = .005;
    materials.simShaderMaterial.uniforms.uPointerDisplacementMagnitude.value = particlesDebugObject.pointerDisplacementMag;
    materials.pointsRenderShaderMaterial.uniforms.uParticleStartColor.value.set(0x3c355f);
    materials.pointsRenderShaderMaterial.uniforms.uParticleEndColor.value.set(0x343555);
    materials.pointsRenderShaderMaterial.uniforms.uParticleTouchColor.value.set(0xa46652);
    pointsMesh.position.set(0, -2, 0);
    const s = particlesDebugObject.modelScale;
    pointsMesh.scale.set(s, s, s);

	scene.add(pointsMesh);
	gPointsMesh = pointsMesh;
	gParticlesMaterial = materials;

	addEventListeners();
	animate();
}

window.onload = onLoad;
