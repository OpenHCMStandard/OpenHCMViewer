// Constants
var CANVAS_WIDTH = 200;
var CANVAS_HEIGHT = 200;
var CAM_DISTANCE = 250;

// Variables
var view, composer, depthMaterial, depthTarget, raycaster;
var renderer, rendererAA, camera, scene;
var overlayRenderer, overlayCamera, overlayScene;
var controls;
var mouse = new THREE.Vector2(), INTERSECTED;
var mesh;
var treeData = null;
var sceneAxes;
var effectFXAA, effectSSAO;

// Preferences
var showAxes = false;
var showMesh = false;
var hasLighting = true;


init();
animate();


function init()
{
	// Drop zone for file loading
	Dropzone.options.fileUploadZone = {
		init: function() {

			// Event handler when a file is added (dropped)
			this.on("addedfile", function(file) {
				loadFile(file);
				// Clear the drop zone
				this.removeAllFiles();
			});
		}
	};

	// Create lights, camera and scene
	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.z = 140;
	//camera.position.y = -140;
	//camera.position.z = 10;
	var camLight = new THREE.PointLight(0x222222, 1.0, 2000);
	camera.add(camLight);

	scene = new THREE.Scene();
	scene.add(camera);
	var ambLight = new THREE.AmbientLight(0xeeeeee);
	scene.add(ambLight);

	raycaster = new THREE.Raycaster();

	// Add axes at origin
	sceneAxes = new THREE.AxisHelper(50);
	if (showAxes)
		scene.add(sceneAxes);

	view = document.getElementById('view3d');

	// Renderers
	renderer = new THREE.WebGLRenderer({ antialias: false });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0x7777DD);

	view.appendChild(renderer.domElement);

	// Depth

	var depthShader = THREE.ShaderLib[ "depthRGBA" ];
	var depthUniforms = THREE.UniformsUtils.clone(depthShader.uniforms);
	depthMaterial = new THREE.ShaderMaterial({
		fragmentShader: depthShader.fragmentShader,
		vertexShader: depthShader.vertexShader,
		uniforms: depthUniforms,
		side: THREE.DoubleSide
	});
	depthMaterial.blending = THREE.NoBlending;

	depthTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat
	});

	// Postprocessing

	effectSSAO = new THREE.ShaderPass(THREE.SSAOShader);
	effectSSAO.uniforms[ 'tDepth' ].value = depthTarget;
	effectSSAO.uniforms[ 'size' ].value.set(window.innerWidth, window.innerHeight);
	effectSSAO.uniforms[ 'cameraNear' ].value = camera.near;
	effectSSAO.uniforms[ 'cameraFar' ].value = camera.far;
	effectSSAO.uniforms[ 'aoClamp' ].value = 0.6; // Cut size more than average
	effectSSAO.uniforms[ 'lumInfluence' ].value = 0.5;
	effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
	effectFXAA.uniforms[ 'resolution' ].value.set(1 / window.innerWidth, 1 / window.innerHeight);
	var effectCopy = new THREE.ShaderPass(THREE.CopyShader);
	effectCopy.renderToScreen = true;

	composer = new THREE.EffectComposer(renderer);
	composer.addPass(new THREE.RenderPass(scene, camera));
	composer.addPass(effectSSAO);
	composer.addPass(effectFXAA);
	composer.addPass(effectCopy);

	// Add overlay Axes
	var overlay = document.getElementById('overlay');
	createOverlayAxes(overlay, 150);

	//var canv = document.getElementsByTagName("canvas")[0];
	controls = new THREE.TrackballControls(camera, view);
	controls.addEventListener('change', render);
	window.addEventListener('resize', onWindowResize, false);
	// Picking deactivated for now. We need to decompose the model into several parts
	//document.addEventListener('mousemove', onDocumentMouseMove, false);

	// First render
	render();
}


function loadFile(file)
{
	$("#dropzone").spin() // Creates a default Spinner using the text color of #dropzone.

	mesh = null;
	updateScene();
	render();

	var meshLoader = new HCMLoader();
	var result = meshLoader.loadFileFromFile(file, function() // On end load
		{
			// Apply user options on the new mesh
			setOptionsOnMesh();
			// Update scene data from the new mesh
			updateScene();
			// Reset camera
			controls.reset();
			// Refresh component tree
			$("#componentTree").jstree(true).settings.core.data = treeData;
			$("#componentTree").jstree(true).redraw(true);
			$("#componentTree").jstree(true).refresh();
			// Draw
			render();
			$("#dropzone").spin(false) // Stop spinner
		});
	mesh = result.mesh;
	treeData = result.treeData;
}


function onWindowResize()
{
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	render();
}


function onDocumentMouseMove(event)
{
	event.preventDefault();

	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = (event.clientY / window.innerHeight) * -2 + 1;
	doPicking();
}


function animate()
{
	// note: three.js includes requestAnimationFrame shim
	requestAnimationFrame(animate);

	controls.update();

	overlayCamera.position.subVectors(camera.position, controls.target);
	overlayCamera.position.setLength(CAM_DISTANCE);
	overlayCamera.lookAt(overlayScene.position);
}


function render()
{
	// First render
	scene.overrideMaterial = depthMaterial;
	renderer.render(scene, camera, depthTarget);
	scene.overrideMaterial = null;
	// Do postprocessing
	composer.render();

	if (showAxes)
		overlayRenderer.render(overlayScene, overlayCamera);
}


function updateScene()
{
	var plateMesh = scene.getObjectByName("PlateMesh");
	if (plateMesh)
		scene.remove(plateMesh);
	var stiffenerMesh = scene.getObjectByName("StiffenerMesh");
	if (stiffenerMesh)
		scene.remove(stiffenerMesh);

	if (!mesh)
		return;

	plateMesh = mesh.getPlateMesh();
	plateMesh.name = "PlateMesh";
	scene.add(plateMesh);
	stiffenerMesh = mesh.getStiffenerMesh();
	stiffenerMesh.name = "StiffenerMesh";
	scene.add(stiffenerMesh);
}


function doPicking()
{
	raycaster.setFromCamera(mouse, camera);

	var intersects = raycaster.intersectObjects(scene.children);
	if (intersects.length > 0)
	{
		if (INTERSECTED != intersects[0].object)
		{
			if (INTERSECTED)
				INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
			INTERSECTED = intersects[0].object;
			INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
			INTERSECTED.material.emissive.setHex(0xff0000);
			render();
		}
	}
	else
	{
		if (INTERSECTED)
		{
			INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
			INTERSECTED = null;
			render();
		}
	}
}


function createOverlayAxes(overlay, length)
{
	overlayRenderer = new THREE.WebGLRenderer({ alpha : true });
	overlayRenderer.setSize(overlay.clientWidth, overlay.clientHeight);
	overlayRenderer.setClearColor(0xAA0000, 0);

	overlay.appendChild(overlayRenderer.domElement);

	overlayScene = new THREE.Scene();

	overlayCamera = new THREE.PerspectiveCamera(75, overlay.clientWidth / overlay.clientHeight, 1, 10000);
	overlayCamera.up = camera.up; // important!

	var overlayAxes = new THREE.AxisHelper(length);
	overlayScene.add(overlayAxes);
}

function setOptionsOnMesh()
{
	mesh.showMesh = showMesh;
	mesh.hasLighting = hasLighting;
}

function toggleAxesVisibility()
{
	showAxes = !showAxes;
	if (!showAxes)
	{
		overlayRenderer.clear();
		scene.remove(sceneAxes);
	}
	else
		scene.add(sceneAxes);
	render();
}

function toggleTriangleMeshVisibility()
{
	showMesh = !showMesh;
	if (!mesh)
		return;
	mesh.showMesh = showMesh;
	updateScene();
	render();
}

function toggleLighting()
{
	hasLighting = !hasLighting;
	if (!mesh)
		return;
	mesh.hasLighting = hasLighting;
	updateScene();
	render();
}

function toggleAO()
{
	effectSSAO.enabled = !effectSSAO.enabled;
	render();
}

function toggleAntialiasing()
{
	effectFXAA.enabled = !effectFXAA.enabled;
	render();
}
