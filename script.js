/*
  Accelerometer Dashboard
  Fetches sensor data from log.json and displays:
  1. Raw data panel
  2. 3D path visualization using Three.js
  3. Placeholder for future features
*/

// Store last 10 data points for visualization
const MAX_POINTS = 10;
let dataPoints = [];

// Three.js variables
let scene, camera, renderer, pathLine, spheres = [];

function setup() {
  initThreeJS();
  setInterval(fetchText, 1000); // Fetch every second for smoother updates
  animate();
}

// Initialize Three.js scene
function initThreeJS() {
  const container = document.getElementById('canvas-container');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);

  // Camera
  camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(3, 3, 3);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Add grid helper for reference
  const gridHelper = new THREE.GridHelper(4, 10, 0x444444, 0x222222);
  scene.add(gridHelper);

  // Add axes helper
  const axesHelper = new THREE.AxesHelper(2);
  scene.add(axesHelper);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  const container = document.getElementById('canvas-container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Slowly rotate camera around the scene
  const time = Date.now() * 0.0005;
  camera.position.x = Math.cos(time) * 4;
  camera.position.z = Math.sin(time) * 4;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

// Fetch data from log.json
function fetchText() {
  let params = {
    mode: 'cors',
    headers: {
      'accept': 'text/json'
    }
  };

  fetch('log.json', params)
    .then(response => response.text())
    .then(data => processData(data))
    .catch(error => console.error('Fetch error:', error));
}

// Process incoming data
function processData(data) {
  const lines = data.trim().split('\n');

  // Parse each line as JSON and extract accelerometer data
  const newPoints = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const parsed = JSON.parse(line);
      if (parsed.AccX !== undefined && parsed.AccY !== undefined && parsed.AccZ !== undefined) {
        newPoints.push({
          x: parsed.AccX,
          y: parsed.AccY,
          z: parsed.AccZ,
          device: parsed.device || 'unknown',
          timestamp: new Date().toLocaleTimeString()
        });
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
  }

  if (newPoints.length > 0) {
    // Take the latest points and add to our buffer
    const latestPoints = newPoints.slice(-MAX_POINTS);

    // Update dataPoints - keep only the last MAX_POINTS
    dataPoints = latestPoints;

    // Update displays
    updateRawDataPanel();
    update3DVisualization();
  }
}

// Update the raw data panel
function updateRawDataPanel() {
  const container = document.getElementById('raw-data');
  container.innerHTML = '';

  // Show newest first
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

// Update 3D visualization
function update3DVisualization() {
  // Remove old spheres
  spheres.forEach(sphere => scene.remove(sphere));
  spheres = [];

  // Remove old line
  if (pathLine) {
    scene.remove(pathLine);
  }

  if (dataPoints.length === 0) return;

  // Create points for the path
  const points = dataPoints.map(p => new THREE.Vector3(p.x, p.y, p.z));

  // Create line geometry
  if (points.length >= 2) {
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x64ffda,
      opacity: 0.5,
      transparent: true
    });
    pathLine = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(pathLine);
  }

  // Create spheres at each point with varying brightness
  dataPoints.forEach((point, index) => {
    // Calculate brightness: newest = brightest (1.0), oldest = dimmest (0.1)
    const brightness = 0.1 + (index / (dataPoints.length - 1 || 1)) * 0.9;

    // Create color with varying intensity
    const color = new THREE.Color();
    color.setHSL(0.47, 1, brightness * 0.5); // Cyan-ish color

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

  // Add a glowing effect to the newest point
  if (dataPoints.length > 0) {
    const newest = dataPoints[dataPoints.length - 1];
    const glowGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x64ffda,
      transparent: true,
      opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(newest.x, newest.y, newest.z);
    scene.add(glow);
    spheres.push(glow);
  }
}

// Start when DOM is loaded
window.addEventListener('DOMContentLoaded', setup);
