/*
  Accelerometer Dashboard
  - Panel 1: Raw accelerometer data
  - Panel 2: 3D path visualization (Three.js with OrbitControls)
  - Panel 3: Physics simulation (Matter.js) with accelerometer-controlled ball
*/

// ============================================
// ACCELEROMETER DATA (Panels 1 & 2)
// ============================================

const MAX_POINTS = 3; // Show only 3 entries in raw data panel
let dataPoints = [];
let lastLineCount = 0;

// Three.js variables
let scene, camera, renderer, controls, pathLine, spheres = [];
let autoRotate = false; // Default: animation off

function setup() {
  initThreeJS();
  initMatterJS();
  setInterval(fetchText, 1000);
  animate();
}

// Initialize Three.js scene
function initThreeJS() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a0a12);

  camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(3, 3, 3);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Orbit Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 2.0;

  // Grid with matching colors
  const gridHelper = new THREE.GridHelper(4, 10, 0x73003A, 0x3C154E);
  scene.add(gridHelper);

  const axesHelper = new THREE.AxesHelper(2);
  scene.add(axesHelper);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Toggle button for auto-rotate
  const toggle = document.getElementById('animation-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      autoRotate = !autoRotate;
      controls.autoRotate = autoRotate;
      toggle.classList.toggle('active', autoRotate);
    });
  }

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  const container = document.getElementById('canvas-container');
  if (!container || !camera || !renderer) return;

  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);

  // Resize Matter.js
  if (matterRender && matterEngine) {
    const matterContainer = document.getElementById('matter-container');
    matterRender.options.width = matterContainer.clientWidth;
    matterRender.options.height = matterContainer.clientHeight;
    matterRender.canvas.width = matterContainer.clientWidth;
    matterRender.canvas.height = matterContainer.clientHeight;
    updateWalls();
  }
}

function animate() {
  requestAnimationFrame(animate);

  if (!renderer || !scene || !camera) return;

  // Update orbit controls
  if (controls) {
    controls.update();
  }

  renderer.render(scene, camera);
}

// Fetch data from log.json
function fetchText() {
  fetch('log.json', {
    mode: 'cors',
    headers: { 'accept': 'text/json' }
  })
    .then(response => response.text())
    .then(data => processData(data))
    .catch(error => console.error('Fetch error:', error));
}

function processData(data) {
  const lines = data.trim().split('\n').filter(line => line.trim());
  const newLines = lines.slice(lastLineCount);

  if (newLines.length > 0) {
    for (const line of newLines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.AccX !== undefined && parsed.AccY !== undefined && parsed.AccZ !== undefined) {
          dataPoints.push({
            x: parsed.AccX,
            y: parsed.AccY,
            z: parsed.AccZ,
            device: parsed.device || 'unknown',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
      } catch (e) { }
    }

    if (dataPoints.length > MAX_POINTS) {
      dataPoints = dataPoints.slice(-MAX_POINTS);
    }

    lastLineCount = lines.length;
    updateRawDataPanel();
    update3DVisualization();
    updateAccelData(); // Store latest accelerometer values
  }
}

function updateRawDataPanel() {
  const container = document.getElementById('raw-data');
  if (!container) return;

  container.innerHTML = '';
  const reversedPoints = [...dataPoints].reverse();

  reversedPoints.forEach((point, index) => {
    const entry = document.createElement('div');
    entry.className = 'data-entry' + (index > 0 ? ' old' : '');
    entry.innerHTML = `
      <div class="timestamp">${point.timestamp} - ${point.device}</div>
      <div class="values">
        <span>X: ${point.x.toFixed(3)}</span>
        <span>Y: ${point.y.toFixed(3)}</span>
        <span>Z: ${point.z.toFixed(3)}</span>
      </div>
    `;
    container.appendChild(entry);
  });
}

function update3DVisualization() {
  if (!scene) return;

  spheres.forEach(sphere => scene.remove(sphere));
  spheres = [];

  if (pathLine) scene.remove(pathLine);
  if (dataPoints.length === 0) return;

  const points = dataPoints.map(p => new THREE.Vector3(p.x, p.y, p.z));

  if (points.length >= 2) {
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xF3B3FF,
      opacity: 0.5,
      transparent: true
    });
    pathLine = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(pathLine);
  }

  dataPoints.forEach((point, index) => {
    const brightness = 0.1 + (index / (dataPoints.length - 1 || 1)) * 0.9;
    const color = new THREE.Color();
    color.setHSL(0.89, 1, brightness * 0.5);

    const geometry = new THREE.SphereGeometry(0.05 + brightness * 0.05, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: brightness
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(point.x, point.y, point.z);
    scene.add(sphere);
    spheres.push(sphere);
  });

  if (dataPoints.length > 0) {
    const newest = dataPoints[dataPoints.length - 1];
    const glowGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xF3B3FF,
      transparent: true,
      opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(newest.x, newest.y, newest.z);
    scene.add(glow);
    spheres.push(glow);
  }
}

// ============================================
// MATTER.JS PHYSICS (Panel 3)
// ============================================

let matterEngine, matterRender, matterRunner;
let walls = { ground: null, ceiling: null, leftWall: null, rightWall: null };
let orangeBall = null; // The accelerometer-controlled ball

// Colors from creative-toolbox + orange
const fillStyles = ['#F3B3FF', '#A63382', '#CED1B6', '#3C154E'];
const avatarTexture = 'images/purple_avatar.png';
const BALL_RADIUS = 45; // Bigger balls (was 30)
const TOTAL_BALLS = 49; // 30% fewer than 70

function initMatterJS() {
  const container = document.getElementById('matter-container');
  if (!container) return;

  const Engine = Matter.Engine;
  const Render = Matter.Render;
  const Runner = Matter.Runner;
  const Composite = Matter.Composite;
  const Mouse = Matter.Mouse;
  const MouseConstraint = Matter.MouseConstraint;

  // Create engine with no gravity (balls float freely)
  matterEngine = Engine.create();
  matterEngine.gravity.x = 0;
  matterEngine.gravity.y = 0;

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Create renderer
  matterRender = Render.create({
    element: container,
    engine: matterEngine,
    options: {
      width: width,
      height: height,
      pixelRatio: window.devicePixelRatio,
      wireframes: false,
      background: 'transparent'
    }
  });

  // Create walls
  createWalls(width, height);

  // Mouse control for dragging
  const mouse = Mouse.create(matterRender.canvas);
  const mouseConstraint = MouseConstraint.create(matterEngine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: { visible: false }
    }
  });

  Composite.add(matterEngine.world, mouseConstraint);
  matterRender.mouse = mouse;

  // Spawn all balls on load
  spawnBallsOnLoad(width, height);

  // Run the engine and renderer
  matterRunner = Runner.create();
  Runner.run(matterRunner, matterEngine);
  Render.run(matterRender);

  // Continuously update orange ball based on accelerometer data
  Matter.Events.on(matterEngine, 'beforeUpdate', updateOrangeBall);
}

function spawnBallsOnLoad(width, height) {
  const Bodies = Matter.Bodies;
  const Composite = Matter.Composite;

  // Create the orange ball first (accelerometer-controlled)
  // Very low density makes it light and responsive
  orangeBall = Bodies.circle(width / 2, height / 2, BALL_RADIUS, {
    restitution: 0.9,
    friction: 0.001,
    frictionAir: 0.005,
    density: 0.0001,
    render: {
      fillStyle: '#F57935'
    },
    label: 'orangeBall'
  });
  Composite.add(matterEngine.world, orangeBall);

  // Spawn the rest of the balls
  for (let i = 0; i < TOTAL_BALLS; i++) {
    // Random position across the container
    const x = Math.random() * width;
    const y = Math.random() * height;

    let renderOptions = {};

    // Every 4th ball uses the avatar texture
    if (i % 4 === 3) {
      renderOptions = {
        sprite: {
          texture: avatarTexture,
          xScale: 0.04, // Bigger scale for bigger balls
          yScale: 0.04
        }
      };
    } else {
      renderOptions = {
        fillStyle: fillStyles[i % 3]
      };
    }

    const circle = Bodies.circle(x, y, BALL_RADIUS, {
      restitution: 0.9,
      friction: 0.001,
      frictionAir: 0.005,
      density: 0.0001,
      render: renderOptions
    });

    Composite.add(matterEngine.world, circle);
  }
}

function createWalls(width, height) {
  const Bodies = Matter.Bodies;
  const Composite = Matter.Composite;

  const wallOptions = {
    isStatic: true,
    render: { visible: false }
  };

  if (walls.ground) {
    Composite.remove(matterEngine.world, [
      walls.ground, walls.ceiling, walls.leftWall, walls.rightWall
    ]);
  }

  walls.ground = Bodies.rectangle(width / 2, height, width, 10, wallOptions);
  walls.ceiling = Bodies.rectangle(width / 2, 0, width, 10, wallOptions);
  walls.leftWall = Bodies.rectangle(0, height / 2, 10, height, wallOptions);
  walls.rightWall = Bodies.rectangle(width, height / 2, 10, height, wallOptions);

  Composite.add(matterEngine.world, [
    walls.ground, walls.ceiling, walls.leftWall, walls.rightWall
  ]);
}

function updateWalls() {
  const container = document.getElementById('matter-container');
  if (!container || !matterEngine) return;
  createWalls(container.clientWidth, container.clientHeight);
}

// Store latest accelerometer values for continuous updates
let latestAccel = { x: 0, y: 0 };

// Update stored accelerometer values when new data arrives
function updateAccelData() {
  if (dataPoints.length === 0) return;
  const latest = dataPoints[dataPoints.length - 1];
  latestAccel.x = latest.x;
  latestAccel.y = latest.y;
}

// Apply accelerometer force to orange ball continuously
function updateOrangeBall() {
  if (!orangeBall || !matterEngine) return;

  // Force magnitude - very high since balls are very light
  const forceMagnitude = 0.0005;

  // Apply force based on tilt (additive, works with gravity)
  Matter.Body.applyForce(orangeBall, orangeBall.position, {
    x: latestAccel.x * forceMagnitude,
    y: -latestAccel.y * forceMagnitude
  });
}

// Start when DOM is loaded
window.addEventListener('DOMContentLoaded', setup);
