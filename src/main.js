import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Aircraft } from './aircraft.js';
import { setupControls } from './gui-controls.js';

let scene, camera, renderer, orbit, aircraft;
let throttle = 0;
let altitude = 0;
let aircraftLabel = '--'; // Store aircraft label for updateUI
let engineOn = false; // Engine state
let autoMode = false;
let aiControlDeltas = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
let aiInterval = null;
let aiFeedbackLog = [];
let autoTakeoff = true;
let takeoffTargetAltitude = 1000 / 3.28; // 1000 ft in units
let takeoffComplete = false;
let takeoffThrottle = 0;
let controlMode = 'autoTakeoff'; // 'autoTakeoff', 'auto', 'pid', 'manual'

// Infinite procedural ground tiling
let groundTiles = [];
const groundTileSize = 40;
const groundGridRadius = 3; // 3x3 grid, reduced for lower memory usage

// Departure and arrival locations (for future globe integration)
let departure = { x: 0, y: 15, z: 0 };
let arrival = { x: 500, y: 15, z: -500 };
let autoTakeoffStartTime = null;

// Remove auto-fetch/init/animate on load
// fetch('parameters.json')
//   .then(res => res.json())
//   .then(params => {
//     init(params);
//     animate();
//   });

// --- Start Simulation Button Overlay ---
function showStartButton() {
  const overlay = document.createElement('div');
  overlay.id = 'start-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0,0,0,0.7)';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = 2000;

  // --- Title ---
  const title = document.createElement('div');
  title.innerHTML = '<span style="font-size:3rem;font-style:italic;font-weight:bold;color:#fff;text-shadow:0 2px 12px #000;letter-spacing:2px;">AI Flight Sim ✈️</span>';
  title.style.marginBottom = '1.5em';
  title.style.textAlign = 'center';
  overlay.appendChild(title);

  // Vehicle selection dropdown
  const selectLabel = document.createElement('label');
  selectLabel.textContent = 'Choose Vehicle: ';
  selectLabel.style.color = '#fff';
  selectLabel.style.fontSize = '1.2rem';
  selectLabel.style.marginBottom = '1em';
  const select = document.createElement('select');
  select.id = 'vehicle-select';
  select.style.fontSize = '1.2rem';
  select.style.marginLeft = '0.5em';
  const optPlane = document.createElement('option');
  optPlane.value = 'plane';
  optPlane.textContent = 'Plane';
  const optDrone = document.createElement('option');
  optDrone.value = 'drone';
  optDrone.textContent = 'Drone';
  select.appendChild(optPlane);
  select.appendChild(optDrone);
  selectLabel.appendChild(select);
  overlay.appendChild(selectLabel);

  const btn = document.createElement('button');
  btn.textContent = 'Start Simulation';
  btn.style.fontSize = '2rem';
  btn.style.padding = '1em 2em';
  btn.style.borderRadius = '12px';
  btn.style.border = 'none';
  btn.style.background = '#228B22';
  btn.style.color = '#fff';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
  btn.onmouseenter = () => btn.style.background = '#2e8b57';
  btn.onmouseleave = () => btn.style.background = '#228B22';

  btn.onclick = () => {
    const vehicleType = select.value;
    overlay.remove();
    startSimulation(vehicleType);
  };

  overlay.appendChild(btn);
  document.body.appendChild(overlay);
}

function startSimulation(vehicleType = 'plane') {
  droneTakeoffComplete = (vehicleType !== 'drone');
  fetch('parameters.json')
    .then(res => res.json())
    .then(params => {
      init(params, vehicleType);
      animate();
    });
}

// Show the start button overlay on page load
window.addEventListener('DOMContentLoaded', showStartButton);

function addTrees(scene, count = 400) {
  for (let i = 0; i < count; i++) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x8B5A2B })
    );
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(0.5 + Math.random() * 0.3, 1 + Math.random() * 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x228B22 })
    );
    const x = (Math.random() - 0.5) * 900;
    const z = (Math.random() - 0.5) * 900;
    trunk.position.set(x, 0.5, z);
    foliage.position.set(x, 1.2, z);
    scene.add(trunk);
    scene.add(foliage);
  }
}

function addClouds(scene, count = 30) {
  for (let i = 0; i < count; i++) {
    const cloud = new THREE.Group();
    const parts = 2 + Math.floor(Math.random() * 3);
    for (let j = 0; j < parts; j++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(1 + Math.random(), 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      puff.position.set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 1,
        (Math.random() - 0.5) * 2
      );
      cloud.add(puff);
    }
    const x = (Math.random() - 0.5) * 900;
    const y = 10 + Math.random() * 30;
    const z = (Math.random() - 0.5) * 900;
    cloud.position.set(x, y, z);
    scene.add(cloud);
  }
}

function createPIDGui(aircraft) {
  // Create GUI container
  const gui = document.createElement('div');
  gui.id = 'pid-gui';
  gui.style.position = 'fixed';
  gui.style.top = '10px';
  gui.style.right = '10px';
  gui.style.background = 'rgba(0,0,0,0.8)';
  gui.style.color = '#fff';
  gui.style.padding = '16px';
  gui.style.borderRadius = '8px';
  gui.style.zIndex = 1000;
  gui.style.fontSize = '14px';
  gui.style.maxWidth = '340px';
  gui.style.display = 'block';

  function slider(id, label, min, max, step, value) {
    return `<label>${label}: <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><span id="${id}-val">${value}</span></label><br>`;
  }

  gui.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <b>PID Tuning</b>
      <button id="hide-gui-btn" style="margin-left:10px;">Hide</button>
    </div>
    <div style="margin:8px 0;">Control Mode: <span id="control-mode-indicator">autoTakeoff</span></div>
    <hr style="border:1px solid #444;">
    <div>
      ${slider('pid-pitch-target', 'Pitch Target', -0.5, 0.5, 0.01, aircraft.targetPitch)}
      ${slider('pid-roll-target', 'Roll Target', -0.5, 0.5, 0.01, aircraft.targetRoll)}
      ${slider('pid-yaw-target', 'Yaw Target', -3.14, 3.14, 0.01, aircraft.targetYaw)}
      ${slider('pid-altitude-target', 'Altitude Target (ft)', 500, 5000, 10, (aircraft.targetAltitude*3.28).toFixed(0))}
    </div>
    <hr style="border:1px solid #444;">
    <div>
      <b>Pitch PID</b><br>
      ${slider('pid-pitch-kp', 'Kp', 0, 2, 0.01, aircraft.pidPitch.kp)}
      ${slider('pid-pitch-ki', 'Ki', 0, 1, 0.01, aircraft.pidPitch.ki)}
      ${slider('pid-pitch-kd', 'Kd', 0, 1, 0.01, aircraft.pidPitch.kd)}
      <b>Roll PID</b><br>
      ${slider('pid-roll-kp', 'Kp', 0, 2, 0.01, aircraft.pidRoll.kp)}
      ${slider('pid-roll-ki', 'Ki', 0, 1, 0.01, aircraft.pidRoll.ki)}
      ${slider('pid-roll-kd', 'Kd', 0, 1, 0.01, aircraft.pidRoll.kd)}
      <b>Yaw PID</b><br>
      ${slider('pid-yaw-kp', 'Kp', 0, 2, 0.01, aircraft.pidYaw.kp)}
      ${slider('pid-yaw-ki', 'Ki', 0, 1, 0.01, aircraft.pidYaw.ki)}
      ${slider('pid-yaw-kd', 'Kd', 0, 1, 0.01, aircraft.pidYaw.kd)}
      <b>Throttle PID</b><br>
      ${slider('pid-throttle-kp', 'Kp', 0, 1, 0.01, aircraft.pidThrottle.kp)}
      ${slider('pid-throttle-ki', 'Ki', 0, 1, 0.01, aircraft.pidThrottle.ki)}
      ${slider('pid-throttle-kd', 'Kd', 0, 1, 0.01, aircraft.pidThrottle.kd)}
    </div>
    <hr style="border:1px solid #444;">
    <div id="ai-deltas-panel"><b>AI Deltas:</b><br>Pitch: <span id="ai-delta-pitch">0</span> | Roll: <span id="ai-delta-roll">0</span> | Yaw: <span id="ai-delta-yaw">0</span> | Throttle: <span id="ai-delta-throttle">0</span></div>
  `;
  document.body.appendChild(gui);

  // Hide/show logic
  document.getElementById('hide-gui-btn').onclick = () => {
    gui.style.display = 'none';
    if (!document.getElementById('show-gui-btn')) {
      const showBtn = document.createElement('button');
      showBtn.id = 'show-gui-btn';
      showBtn.textContent = 'Show PID GUI';
      showBtn.style.position = 'fixed';
      showBtn.style.top = '10px';
      showBtn.style.right = '10px';
      showBtn.style.zIndex = 1001;
      document.body.appendChild(showBtn);
      showBtn.onclick = () => {
        gui.style.display = 'block';
        showBtn.remove();
      };
    }
  };

  // Update aircraft PID and targets on slider change
  function bindSlider(id, cb) {
    const slider = document.getElementById(id);
    const valSpan = document.getElementById(id+'-val');
    slider.addEventListener('input', e => {
      cb(parseFloat(e.target.value));
      valSpan.textContent = e.target.value;
    });
  }
  bindSlider('pid-pitch-target', v => aircraft.targetPitch = v);
  bindSlider('pid-roll-target', v => aircraft.targetRoll = v);
  bindSlider('pid-yaw-target', v => aircraft.targetYaw = v);
  bindSlider('pid-altitude-target', v => aircraft.targetAltitude = v / 3.28);
  bindSlider('pid-pitch-kp', v => aircraft.pidPitch.kp = v);
  bindSlider('pid-pitch-ki', v => aircraft.pidPitch.ki = v);
  bindSlider('pid-pitch-kd', v => aircraft.pidPitch.kd = v);
  bindSlider('pid-roll-kp', v => aircraft.pidRoll.kp = v);
  bindSlider('pid-roll-ki', v => aircraft.pidRoll.ki = v);
  bindSlider('pid-roll-kd', v => aircraft.pidRoll.kd = v);
  bindSlider('pid-yaw-kp', v => aircraft.pidYaw.kp = v);
  bindSlider('pid-yaw-ki', v => aircraft.pidYaw.ki = v);
  bindSlider('pid-yaw-kd', v => aircraft.pidYaw.kd = v);
  bindSlider('pid-throttle-kp', v => aircraft.pidThrottle.kp = v);
  bindSlider('pid-throttle-ki', v => aircraft.pidThrottle.ki = v);
  bindSlider('pid-throttle-kd', v => aircraft.pidThrottle.kd = v);

  // Update AI deltas panel and control mode every frame
  function updateAIDeltasPanel() {
    document.getElementById('ai-delta-pitch').textContent = aiControlDeltas.pitch.toFixed(4);
    document.getElementById('ai-delta-roll').textContent = aiControlDeltas.roll.toFixed(4);
    document.getElementById('ai-delta-yaw').textContent = aiControlDeltas.yaw.toFixed(4);
    document.getElementById('ai-delta-throttle').textContent = aiControlDeltas.throttle.toFixed(4);
    document.getElementById('control-mode-indicator').textContent = controlMode;
  }
  setInterval(updateAIDeltasPanel, 200);
}

function init(params, vehicleType = 'plane') {
  // Scene Setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Sky blue

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 3, 10);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);

  // Orbit Controls (for dev only)
  orbit = new OrbitControls(camera, renderer.domElement);

  if (vehicleType === 'drone') {
    // --- Drone Setup ---
    drone = createDroneMesh();
    drone.position.set(0, 5, 0);
    scene.add(drone);
    setupDroneControls();
  } else {
    // --- Aircraft Setup ---
    aircraft = new Aircraft(scene, params.aircraft);
    aircraft.mesh.position.set(0, 15, 0);
    scene.add(aircraft.mesh);
    createPIDGui(aircraft);
  }

  // Camera behind vehicle
  camera.position.set(0, 3, 10);
  if (vehicleType === 'drone') {
    camera.lookAt(drone.position);
  } else {
    camera.lookAt(aircraft.mesh.position);
  }

  // Setup Keyboard Controls
  if (vehicleType === 'plane') {
    setupControls(params.controls, (delta) => {
      aircraft.pitch(delta.pitch);
      aircraft.yaw(delta.yaw);
      aircraft.roll(delta.roll);
      throttle += delta.throttle;
      throttle = Math.max(0, Math.min(1, throttle));
      updateUI(params.altimeter, throttle);
    });
    aircraftLabel = params.aircraft.label;
  }

  // Engine toggle handler (plane only)
  if (vehicleType === 'plane') {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        engineOn = !engineOn;
        updateUI(params.altimeter, throttle);
      }
    });
  }

  // Add procedural trees and clouds using config
  const numTrees = params.controls.numTrees || 400;
  const numClouds = params.controls.numClouds || 30;
  addTrees(scene, numTrees);
  addClouds(scene, numClouds);
  createStatsPanel();
  createSimOverlay(vehicleType);
}

function updateUI(altimeterConfig, throttle) {
  // Get aircraft altitude from mesh position
  let aircraftAltitude = 0;
  if (aircraft && aircraft.mesh) {
    aircraftAltitude = aircraft.mesh.position.y;
  }
  // Altitude in feet (1 unit = 3.28 feet)
  const altitudeFeet = aircraftAltitude * 3.28;
  // Altitude in dollars (using scale and base from config)
  const base = altimeterConfig.baseElevation;
  const scale = altimeterConfig.scaleFactor;
  const altitudeDollars = base + aircraftAltitude * scale;
  const altUnit = altimeterConfig.unit;

  document.getElementById("label").innerText = `Label: ${aircraftLabel}`;
  document.getElementById("altitude").innerText = `Altitude: ${altitudeFeet.toFixed(2)} ft | ${altitudeDollars.toFixed(2)} ${altUnit}`;
  document.getElementById("throttle").innerText = `Throttle: ${(throttle * 100).toFixed(0)}%`;

  // Show engine status
  let engineStatus = document.getElementById("engine-status");
  if (!engineStatus) {
    engineStatus = document.createElement("div");
    engineStatus.id = "engine-status";
    document.getElementById("info-panel").appendChild(engineStatus);
  }
  engineStatus.innerText = `Engine: ${engineOn ? 'ON' : 'OFF'} (E to toggle)`;
}

function setAutoMode(enabled) {
  autoMode = enabled;
  if (autoMode) {
    aiInterval = setInterval(() => {
      if (!aircraft || !aircraft.mesh) return;
      const data = {
        position: aircraft.mesh.position,
        velocity: aircraft.velocity,
        quaternion: aircraft.mesh.quaternion,
        throttle,
        engineOn
      };
      const plainData = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value && value.isVector3) return { x: value.x, y: value.y, z: value.z };
        if (value && value.isQuaternion) return { x: value.x, y: value.y, z: value.z, w: value.w };
        return value;
      }));
      sendFlightDataToAI(plainData, 'control');
    }, 1800000); // every 30 minutes
  } else if (aiInterval) {
    clearInterval(aiInterval);
    aiInterval = null;
    aiControlDeltas = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
  }
}

async function sendFlightDataToAI(flightData, mode = 'feedback') {
  try {
    const response = await fetch('http://localhost:3001/api/flight-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flightData, mode })
    });
    const result = await response.json();
    aiFeedbackLog.push({
      timestamp: Date.now(),
      mode,
      flightData,
      aiResponse: result.aiResponse
    });
    if (mode === 'control') {
      // Expecting a JSON object with deltas and targets
      let deltas = {};
      let feedbackText = '';
      try {
        deltas = JSON.parse(result.aiResponse);
        aiControlDeltas = {
          pitch: Math.max(-0.05, Math.min(0.05, deltas.pitch || 0)),
          roll: Math.max(-0.05, Math.min(0.05, deltas.roll || 0)),
          yaw: Math.max(-0.05, Math.min(0.05, deltas.yaw || 0)),
          throttle: Math.max(-0.01, Math.min(0.01, deltas.throttle || 0))
        };
        // Apply AI-suggested PID targets if present
        if (typeof deltas.targetPitch === 'number') {
          aircraft.targetPitch = deltas.targetPitch;
        }
        if (typeof deltas.targetRoll === 'number') {
          aircraft.targetRoll = deltas.targetRoll;
        }
        if (typeof deltas.targetYaw === 'number') {
          aircraft.targetYaw = deltas.targetYaw;
        }
        if (typeof deltas.targetAltitude === 'number') {
          aircraft.targetAltitude = deltas.targetAltitude;
        }
        syncPIDGuiToAircraftTargets();
        feedbackText = 'AI Control Deltas received.';
      } catch (e) {
        aiControlDeltas = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
        feedbackText = 'AI response was not valid JSON.';
      }
      updateAIFeedbackPanel(feedbackText, deltas);
    } else {
      // Log feedback to console instead of alert
      console.log('AI Suggestion:', result.aiResponse);
      updateAIFeedbackPanel(result.aiResponse, null);
    }
  } catch (err) {
    console.error('Failed to get AI feedback:', err);
    updateAIFeedbackPanel('Failed to get AI feedback.', null);
  }
}

function syncPIDGuiToAircraftTargets() {
  const setSlider = (id, value) => {
    const slider = document.getElementById(id);
    const valSpan = document.getElementById(id+'-val');
    if (slider) slider.value = value;
    if (valSpan) valSpan.textContent = value;
  };
  setSlider('pid-pitch-target', aircraft.targetPitch);
  setSlider('pid-roll-target', aircraft.targetRoll);
  setSlider('pid-yaw-target', aircraft.targetYaw);
  setSlider('pid-altitude-target', (aircraft.targetAltitude * 3.28).toFixed(0));
}

function setControlMode(newMode) {
  if (controlMode !== newMode) {
    controlMode = newMode;
    const indicator = document.getElementById('control-mode-indicator');
    if (indicator) indicator.textContent = controlMode;
    console.log('Control mode switched to:', controlMode);
  }
}

function animate() {
  requestAnimationFrame(animate);
  // --- Drone Mode ---
  if (drone) {
    // dt for smooth movement
    const dt = 1/60;
    if (droneAutoMode && droneTakeoffComplete) applyDroneAIControl();
    updateDrone(dt);
    // Camera: chase from behind and above
    const camOffset = new THREE.Vector3(0, 2.5, 6).applyAxisAngle(new THREE.Vector3(0,1,0), droneYaw);
    const targetPos = drone.position.clone().add(camOffset);
    camera.position.lerp(targetPos, 0.18);
    camera.lookAt(drone.position);
    createInfiniteGround(scene, { mesh: drone });
    renderer.render(scene, camera);
    return;
  }
  // --- Plane Mode ---
  if (aircraft && aircraft.update) {
    // --- Control Mode Logic ---
    if (controlMode === 'autoTakeoff') {
      if (!autoTakeoffStartTime) autoTakeoffStartTime = Date.now();
      engineOn = true;
      // Smoother auto takeoff logic
      takeoffThrottle = Math.min(1, takeoffThrottle + 0.01);
      throttle = takeoffThrottle;
      aircraft.targetPitch = -0.12;
      // Timeout for takeoff (60 seconds)
      const takeoffTimeout = 60000;
      if (
        aircraft.mesh.position.y >= takeoffTargetAltitude ||
        (Date.now() - autoTakeoffStartTime > takeoffTimeout)
      ) {
        takeoffComplete = true;
        autoTakeoff = false;
        setControlMode(autoMode ? 'auto' : 'pid');
        aircraft.targetPitch = -0.1; // switch to normal cruise
        autoTakeoffStartTime = null;
      }
    } else if (autoMode && controlMode === 'auto') {
      // AI + PID blended control
      const pidPitch = aircraft.pidPitch.update(aircraft.targetPitch, new THREE.Euler().setFromQuaternion(aircraft.mesh.quaternion, 'YXZ').x);
      const pidRoll = aircraft.pidRoll.update(aircraft.targetRoll, new THREE.Euler().setFromQuaternion(aircraft.mesh.quaternion, 'YXZ').z);
      const pidYaw = aircraft.pidYaw.update(aircraft.targetYaw, new THREE.Euler().setFromQuaternion(aircraft.mesh.quaternion, 'YXZ').y);
      const pidThrottle = aircraft.pidThrottle.update(aircraft.targetAltitude, aircraft.mesh.position.y);
      aircraft.pitch((aiControlDeltas.pitch + pidPitch) / 2);
      aircraft.roll((aiControlDeltas.roll + pidRoll) / 2);
      aircraft.yaw((aiControlDeltas.yaw + pidYaw) / 2);
      throttle += (aiControlDeltas.throttle + pidThrottle) / 2;
      throttle = Math.max(0, Math.min(1, throttle));
      // Check if close to arrival for autolanding
      const dx = aircraft.mesh.position.x - arrival.x;
      const dz = aircraft.mesh.position.z - arrival.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < 50) {
        setControlMode('autoLanding');
      }
    } else if (controlMode === 'autoLanding') {
      // Simple autolanding: reduce throttle, descend to y=0
      aircraft.targetPitch = 0.1; // nose up for gentle descent
      aircraft.targetAltitude = 0.5;
      throttle = Math.max(0, throttle - 0.005);
      if (aircraft.mesh.position.y <= 1) {
        setControlMode('pid'); // Switch to PID/manual after landing
      }
    } else if (!autoMode && controlMode === 'pid') {
      // Pure PID control
      const pidPitch = aircraft.pidPitch.update(aircraft.targetPitch, new THREE.Euler().setFromQuaternion(aircraft.mesh.quaternion, 'YXZ').x);
      const pidRoll = aircraft.pidRoll.update(aircraft.targetRoll, new THREE.Euler().setFromQuaternion(aircraft.mesh.quaternion, 'YXZ').z);
      const pidYaw = aircraft.pidYaw.update(aircraft.targetYaw, new THREE.Euler().setFromQuaternion(aircraft.mesh.quaternion, 'YXZ').y);
      const pidThrottle = aircraft.pidThrottle.update(aircraft.targetAltitude, aircraft.mesh.position.y);
      aircraft.pitch(pidPitch);
      aircraft.roll(pidRoll);
      aircraft.yaw(pidYaw);
      throttle += pidThrottle;
      throttle = Math.max(0, Math.min(1, throttle));
    } else if (controlMode === 'manual') {
      // Manual mode (user input)
      // This mode is handled by the setupControls callback
    }
    if (engineOn) {
      aircraft.update(throttle);
    }
    // Update infinite ground
    createInfiniteGround(scene, aircraft);
  }
  // Improved chase camera: smoothly follow behind and above the aircraft
  if (aircraft && camera) {
    const targetPos = aircraft.mesh.position.clone().add(new THREE.Vector3(0, 3, 10).applyQuaternion(aircraft.mesh.quaternion));
    camera.position.lerp(targetPos, 0.1); // Smooth follow
    camera.lookAt(aircraft.mesh.position);
  }
  renderer.render(scene, camera);
}

function exportFlightData() {
  if (!aircraft || !aircraft.mesh) return;
  const data = {
    position: aircraft.mesh.position,
    velocity: aircraft.velocity,
    quaternion: aircraft.mesh.quaternion,
    throttle,
    engineOn
  };
  const json = JSON.stringify(data, (key, value) => {
    // Convert THREE.Vector3 and Quaternion to plain objects
    if (value && value.isVector3) {
      return { x: value.x, y: value.y, z: value.z };
    }
    if (value && value.isQuaternion) {
      return { x: value.x, y: value.y, z: value.z, w: value.w };
    }
    return value;
  }, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'flight_data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportAIFeedbackLog() {
  const json = JSON.stringify(aiFeedbackLog, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ai_feedback_log.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyL') {
    exportFlightData();
    // Also force an AI feedback call to create the log file
    if (!aircraft || !aircraft.mesh) return;
    const data = {
      position: aircraft.mesh.position,
      velocity: aircraft.velocity,
      quaternion: aircraft.mesh.quaternion,
      throttle,
      engineOn
    };
    const plainData = JSON.parse(JSON.stringify(data, (key, value) => {
      if (value && value.isVector3) return { x: value.x, y: value.y, z: value.z };
      if (value && value.isQuaternion) return { x: value.x, y: value.y, z: value.z, w: value.w };
      return value;
    }));
    sendFlightDataToAI(plainData, 'feedback');
  }
  if (e.code === 'KeyJ') {
    exportAIFeedbackLog();
  }
  if (e.code === 'KeyK') {
    if (!aircraft || !aircraft.mesh) return;
    const data = {
      position: aircraft.mesh.position,
      velocity: aircraft.velocity,
      quaternion: aircraft.mesh.quaternion,
      throttle,
      engineOn
    };
    const plainData = JSON.parse(JSON.stringify(data, (key, value) => {
      if (value && value.isVector3) return { x: value.x, y: value.y, z: value.z };
      if (value && value.isQuaternion) return { x: value.x, y: value.y, z: value.z, w: value.w };
      return value;
    }));
    sendFlightDataToAI(plainData);
  }
  if (e.code === 'Backslash') {
    setAutoMode(!autoMode);
    setControlMode(autoMode ? (takeoffComplete ? 'auto' : 'autoTakeoff') : (takeoffComplete ? 'pid' : 'autoTakeoff'));
    alert('AI Auto Mode: ' + (autoMode ? 'ON' : 'OFF'));
  }
  if (e.code === 'Slash') {
    setControlMode('manual');
    alert('Manual Mode: ON');
  }
  if (e.code === 'KeyH') {
    if (!aircraft || !aircraft.mesh) return;
    const data = {
      position: aircraft.mesh.position,
      velocity: aircraft.velocity,
      quaternion: aircraft.mesh.quaternion,
      throttle,
      engineOn
    };
    fetch('http://localhost:3001/api/manual-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flightData: data })
    }).then(() => {
      alert('Flight data appended to log!');
    });
  }
  if (e.code === 'KeyC') {
    if (!aircraft || !aircraft.mesh) return;
    const data = {
      position: aircraft.mesh.position,
      velocity: aircraft.velocity,
      quaternion: aircraft.mesh.quaternion,
      throttle,
      engineOn
    };
    const plainData = JSON.parse(JSON.stringify(data, (key, value) => {
      if (value && value.isVector3) return { x: value.x, y: value.y, z: value.z };
      if (value && value.isQuaternion) return { x: value.x, y: value.y, z: value.z, w: value.w };
      return value;
    }));
    sendFlightDataToAI(plainData, 'control');
    alert('Forced AI control call sent!');
  }
});

function createInfiniteGround(scene, aircraft) {
  // Remove old tiles
  for (const tile of groundTiles) scene.remove(tile);
  groundTiles = [];
  // Center grid on aircraft
  const cx = Math.round(aircraft.mesh.position.x / groundTileSize) * groundTileSize;
  const cz = Math.round(aircraft.mesh.position.z / groundTileSize) * groundTileSize;
  for (let dx = -groundGridRadius; dx <= groundGridRadius; dx++) {
    for (let dz = -groundGridRadius; dz <= groundGridRadius; dz++) {
      const x = cx + dx * groundTileSize;
      const z = cz + dz * groundTileSize;
      const color = (Math.floor(x / groundTileSize) + Math.floor(z / groundTileSize)) % 2 === 0 ? 0x228B22 : 0x2e8b57;
      const groundTile = new THREE.Mesh(
        new THREE.PlaneGeometry(groundTileSize, groundTileSize),
        new THREE.MeshStandardMaterial({ color })
      );
      groundTile.rotation.x = -Math.PI / 2;
      groundTile.position.set(x, 0, z);
      scene.add(groundTile);
      groundTiles.push(groundTile);
    }
  }
}

// Add a stats panel for memory usage and FPS
function createStatsPanel() {
  let statsPanel = document.getElementById('stats-panel');
  if (!statsPanel) {
    statsPanel = document.createElement('div');
    statsPanel.id = 'stats-panel';
    statsPanel.style.position = 'absolute';
    statsPanel.style.top = 'unset';
    statsPanel.style.bottom = '10px';
    statsPanel.style.left = '10px';
    statsPanel.style.background = 'rgba(0,0,0,0.7)';
    statsPanel.style.color = '#fff';
    statsPanel.style.padding = '8px 14px';
    statsPanel.style.borderRadius = '6px';
    statsPanel.style.fontSize = '14px';
    statsPanel.style.zIndex = 1002;
    document.body.appendChild(statsPanel);
  }
  let lastFrame = performance.now();
  let frames = 0;
  let fps = 0;
  setInterval(() => {
    frames++;
    const now = performance.now();
    if (now - lastFrame >= 1000) {
      fps = frames;
      frames = 0;
      lastFrame = now;
    }
    let mem = window.performance && performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) : 'N/A';
    let emoji = controlMode === 'auto' ? '🧠' : (controlMode === 'manual' ? '🤚' : '✈️');
    statsPanel.innerHTML = `<b>Stats</b> ${emoji}<br>FPS: ${fps}<br>Memory: ${mem} MB`;
  }, 500);
  // Count frames for FPS
  function countFrame() { frames++; requestAnimationFrame(countFrame); }
  countFrame();
}

// --- Drone Model and Controls ---
function createDroneMesh() {
  const group = new THREE.Group();
  // Central body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.4 })
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);
  // Arms
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    );
    arm.position.set(Math.cos(i * Math.PI/2) * 1.1, 0, Math.sin(i * Math.PI/2) * 1.1);
    arm.rotation.z = i % 2 === 0 ? Math.PI/4 : -Math.PI/4;
    group.add(arm);
    // Rotors
    const rotor = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.07, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x00aaff })
    );
    rotor.position.set(Math.cos(i * Math.PI/2) * 1.1, 0.15, Math.sin(i * Math.PI/2) * 1.1);
    rotor.rotation.x = Math.PI/2;
    group.add(rotor);
  }
  // Camera dome
  const cam = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x3333ff, metalness: 0.7, roughness: 0.2 })
  );
  cam.position.set(0, -0.18, 0.35);
  group.add(cam);
  return group;
}

// Drone state
let drone = null;
let droneVelocity = new THREE.Vector3();
let droneYaw = 0;
let dronePitch = 0;
let droneRoll = 0;
let droneBoost = false;
let droneAscend = false;
let droneDescend = false;
let droneControl = {
  forward: false, backward: false, left: false, right: false,
  yawLeft: false, yawRight: false, up: false, down: false, boost: false
};

function setupDroneControls() {
  window.addEventListener('keydown', droneKeyHandler);
  window.addEventListener('keyup', droneKeyHandler);
}

function droneKeyHandler(e) {
  const down = e.type === 'keydown';
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': droneControl.forward = down; break;
    case 'KeyS': case 'ArrowDown': droneControl.backward = down; break;
    case 'KeyA': case 'ArrowLeft': droneControl.left = down; break;
    case 'KeyD': case 'ArrowRight': droneControl.right = down; break;
    case 'KeyQ': droneControl.up = down; break;
    case 'KeyE': droneControl.down = down; break;
    case 'ShiftLeft': case 'ShiftRight': droneControl.boost = down; break;
    case 'KeyZ': droneControl.yawLeft = down; break;
    case 'KeyC': droneControl.yawRight = down; break;
  }
}



// --- Drone Info Panel ---
function createDroneInfoPanel() {
  let infoPanel = document.getElementById('drone-info-panel');
  if (!infoPanel) {
    infoPanel = document.createElement('div');
    infoPanel.id = 'drone-info-panel';
    infoPanel.style.position = 'absolute';
    infoPanel.style.top = '10px';
    infoPanel.style.left = '10px';
    infoPanel.style.background = 'rgba(0,0,0,0.7)';
    infoPanel.style.color = '#fff';
    infoPanel.style.padding = '10px 16px';
    infoPanel.style.borderRadius = '6px';
    infoPanel.style.fontSize = '15px';
    infoPanel.style.zIndex = 1002;
    infoPanel.innerHTML = `<b>Drone Mode</b><br>
      <b>WASD/Arrows</b>: Move<br>
      <b>Q/E</b>: Up/Down<br>
      <b>Z/C</b>: Yaw Left/Right<br>
      <b>Shift</b>: Boost<br>
      <b>Space</b>: Hover (coming soon)`;
    document.body.appendChild(infoPanel);
  }
}

// --- Drone AI Integration ---
let droneAutoMode = false;
let droneAIInterval = null;
let droneAIFeedbackLog = [];
let droneAIControlDeltas = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };

function setDroneAutoMode(enabled) {
  droneAutoMode = enabled;
  if (droneAutoMode) {
    droneAIInterval = setInterval(() => {
      if (!drone || !droneTakeoffComplete) return;
      const data = getDroneState();
      sendDroneStateToAI(data, 'control');
    }, 1800000); // every 30 minutes (same as aircraft)
  } else if (droneAIInterval) {
    clearInterval(droneAIInterval);
    droneAIInterval = null;
    droneAIControlDeltas = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
  }
}

function getDroneState() {
  return {
    position: drone.position,
    velocity: droneVelocity,
    rotation: { x: drone.rotation.x, y: drone.rotation.y, z: drone.rotation.z },
    yaw: droneYaw,
    pitch: dronePitch,
    roll: droneRoll
  };
}

async function sendDroneStateToAI(droneState, mode = 'feedback') {
  try {
    const response = await fetch('http://localhost:3001/api/flight-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flightData: droneState, mode, vehicleType: 'drone' })
    });
    const result = await response.json();
    droneAIFeedbackLog.push({
      timestamp: Date.now(),
      mode,
      droneState,
      aiResponse: result.aiResponse
    });
    if (mode === 'control') {
      let deltas = {};
      let feedbackText = '';
      try {
        deltas = JSON.parse(result.aiResponse);
        // Clamp deltas for arcade style
        droneAIControlDeltas = {
          pitch: Math.max(-0.2, Math.min(0.2, deltas.pitch || 0)),
          roll: Math.max(-0.2, Math.min(0.2, deltas.roll || 0)),
          yaw: Math.max(-0.2, Math.min(0.2, deltas.yaw || 0)),
          throttle: Math.max(-0.2, Math.min(0.2, deltas.throttle || 0))
        };
        feedbackText = 'AI Drone Control Deltas received.';
      } catch (e) {
        droneAIControlDeltas = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
        feedbackText = 'AI response was not valid JSON.';
      }
      updateAIFeedbackPanel(feedbackText, deltas);
    } else {
      updateAIFeedbackPanel(result.aiResponse, null);
    }
  } catch (err) {
    console.error('Failed to get AI feedback (drone):', err);
    updateAIFeedbackPanel('Failed to get AI feedback (drone).', null);
  }
}

function exportDroneAIFeedbackLog() {
  const json = JSON.stringify(droneAIFeedbackLog, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drone_ai_feedback_log.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Drone AI Toggle Button ---
function createDroneAIToggleButton() {
  let btn = document.getElementById('drone-ai-toggle-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'drone-ai-toggle-btn';
    btn.textContent = 'AI: OFF';
    btn.style.position = 'fixed';
    btn.style.top = '20px';
    btn.style.right = '20px';
    btn.style.zIndex = 2001;
    btn.style.fontSize = '1.3rem';
    btn.style.padding = '0.6em 1.2em';
    btn.style.borderRadius = '10px';
    btn.style.border = 'none';
    btn.style.background = '#444';
    btn.style.color = '#fff';
    btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    btn.style.cursor = 'pointer';
    btn.onclick = () => {
      setDroneAutoMode(!droneAutoMode);
      btn.textContent = 'AI: ' + (droneAutoMode ? 'ON' : 'OFF');
      btn.style.background = droneAutoMode ? '#228B22' : '#444';
    };
    document.body.appendChild(btn);
  }
  // Set initial state
  btn.textContent = 'AI: ' + (droneAutoMode ? 'ON' : 'OFF');
  btn.style.background = droneAutoMode ? '#228B22' : '#444';
}
function removeDroneAIToggleButton() {
  let btn = document.getElementById('drone-ai-toggle-btn');
  if (btn) btn.remove();
}

// --- Show/hide AI toggle button based on mode ---
function updateDroneUIElements(vehicleType) {
  if (vehicleType === 'drone') {
    createDroneAIToggleButton();
  } else {
    removeDroneAIToggleButton();
  }
}

// --- Unified Overlay ---
function createSimOverlay(vehicleType) {
  // Remove old overlays
  ['info-panel', 'stats-panel', 'ai-feedback-panel', 'drone-info-panel', 'drone-ai-toggle-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  let overlay = document.getElementById('sim-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sim-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '30px';
    overlay.style.left = '30px';
    overlay.style.width = '370px';
    overlay.style.minWidth = '260px';
    overlay.style.maxWidth = '90vw';
    overlay.style.height = 'auto';
    overlay.style.background = 'rgba(20,20,20,0.92)';
    overlay.style.color = '#fff';
    overlay.style.padding = '18px 18px 12px 18px';
    overlay.style.borderRadius = '12px';
    overlay.style.zIndex = 3000;
    overlay.style.fontSize = '15px';
    overlay.style.resize = 'both';
    overlay.style.overflow = 'auto';
    overlay.style.boxShadow = '0 4px 24px rgba(0,0,0,0.25)';
    overlay.style.userSelect = 'none';
    // Draggable
    overlay.onmousedown = function(e) {
      if (e.target !== overlay) return;
      let shiftX = e.clientX - overlay.getBoundingClientRect().left;
      let shiftY = e.clientY - overlay.getBoundingClientRect().top;
      function moveAt(pageX, pageY) {
        overlay.style.left = pageX - shiftX + 'px';
        overlay.style.top = pageY - shiftY + 'px';
      }
      function onMouseMove(e) { moveAt(e.pageX, e.pageY); }
      document.addEventListener('mousemove', onMouseMove);
      document.onmouseup = function() {
        document.removeEventListener('mousemove', onMouseMove);
        document.onmouseup = null;
      };
    };
    overlay.ondragstart = () => false;
    document.body.appendChild(overlay);
  }
  // Tabs
  overlay.innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:10px;">
      <button class="sim-tab-btn" data-tab="info">Info</button>
      <button class="sim-tab-btn" data-tab="stats">Stats</button>
      <button class="sim-tab-btn" data-tab="ai">AI</button>
      <button class="sim-tab-btn" data-tab="controls">Controls</button>
      <span style="flex:1"></span>
      <button id="close-sim-overlay" style="background:#222;color:#fff;border:none;border-radius:6px;padding:2px 10px;cursor:pointer;">✕</button>
    </div>
    <div id="sim-tab-content"></div>
  `;
  document.getElementById('close-sim-overlay').onclick = () => overlay.remove();
  // Tab switching
  const tabContent = overlay.querySelector('#sim-tab-content');
  function showTab(tab) {
    document.querySelectorAll('.sim-tab-btn').forEach(btn => btn.style.background = '#222');
    overlay.querySelector(`.sim-tab-btn[data-tab="${tab}"]`).style.background = '#228B22';
    if (tab === 'info') {
      tabContent.innerHTML = vehicleType === 'drone' ?
        `<b>Drone Mode</b><br>Vehicle: <b>Drone</b><br>Position: <span id="drone-pos"></span><br>Altitude: <span id="drone-alt"></span>` :
        `<b>Plane Mode</b><br>Vehicle: <b>${aircraftLabel}</b><br>Altitude: <span id="plane-alt"></span>`;
    } else if (tab === 'stats') {
      tabContent.innerHTML = `<b>Stats</b><br>FPS: <span id="sim-fps"></span><br>Memory: <span id="sim-mem"></span> MB`;
    } else if (tab === 'ai') {
      tabContent.innerHTML = `
        <b>AI Feedback</b><br>
        <div id="ai-feedback-text">Waiting for AI...</div>
        <pre id="ai-feedback-json" style="font-size:12px;background:rgba(0,0,0,0.3);padding:6px;border-radius:4px;overflow-x:auto;"></pre>
        <button id="ai-toggle-btn" style="margin-top:8px;background:#444;color:#fff;border:none;border-radius:8px;padding:6px 18px;cursor:pointer;font-size:1.1rem;">AI: OFF</button>
        <button id="ai-export-btn" style="margin-top:8px;margin-left:10px;background:#444;color:#fff;border:none;border-radius:8px;padding:6px 18px;cursor:pointer;font-size:1.1rem;">Export Log</button>
      `;
      // AI toggle
      const aiBtn = document.getElementById('ai-toggle-btn');
      if (vehicleType === 'drone') {
        aiBtn.textContent = 'AI: ' + (droneAutoMode ? 'ON' : 'OFF');
        aiBtn.style.background = droneAutoMode ? '#228B22' : '#444';
        aiBtn.onclick = () => {
          setDroneAutoMode(!droneAutoMode);
          aiBtn.textContent = 'AI: ' + (droneAutoMode ? 'ON' : 'OFF');
          aiBtn.style.background = droneAutoMode ? '#228B22' : '#444';
        };
        document.getElementById('ai-export-btn').onclick = exportDroneAIFeedbackLog;
      } else {
        aiBtn.textContent = 'AI: ' + (autoMode ? 'ON' : 'OFF');
        aiBtn.style.background = autoMode ? '#228B22' : '#444';
        aiBtn.onclick = () => {
          setAutoMode(!autoMode);
          setControlMode(autoMode ? (takeoffComplete ? 'auto' : 'autoTakeoff') : (takeoffComplete ? 'pid' : 'autoTakeoff'));
          aiBtn.textContent = 'AI: ' + (autoMode ? 'ON' : 'OFF');
          aiBtn.style.background = autoMode ? '#228B22' : '#444';
        };
        document.getElementById('ai-export-btn').onclick = exportAIFeedbackLog;
      }
    } else if (tab === 'controls') {
      tabContent.innerHTML = vehicleType === 'drone' ?
        `<b>Drone Controls</b><br>
        <b>WASD/Arrows</b>: Move<br>
        <b>Q/E</b>: Up/Down<br>
        <b>Z/C</b>: Yaw Left/Right<br>
        <b>Shift</b>: Boost<br>
        <b>Space</b>: Hover (coming soon)` :
        `<b>Plane Controls</b><br>
        <b>WASD/Arrows</b>: Pitch/Roll/Yaw<br>
        <b>+/-</b>: Throttle<br>
        <b>E</b>: Engine Toggle`;
    }
  }
  overlay.querySelectorAll('.sim-tab-btn').forEach(btn => {
    btn.onclick = () => showTab(btn.getAttribute('data-tab'));
  });
  showTab('info');
}

// --- Update overlay content in real time ---
function updateSimOverlay(vehicleType) {
  const overlay = document.getElementById('sim-overlay');
  if (!overlay) return;
  if (vehicleType === 'drone') {
    const pos = drone ? `${drone.position.x.toFixed(2)}, ${drone.position.y.toFixed(2)}, ${drone.position.z.toFixed(2)}` : '--';
    const alt = drone ? (drone.position.y * 3.28).toFixed(2) + ' ft' : '--';
    const posEl = overlay.querySelector('#drone-pos');
    const altEl = overlay.querySelector('#drone-alt');
    if (posEl) posEl.textContent = pos;
    if (altEl) altEl.textContent = alt;
  } else {
    const alt = aircraft && aircraft.mesh ? (aircraft.mesh.position.y * 3.28).toFixed(2) + ' ft' : '--';
    const altEl = overlay.querySelector('#plane-alt');
    if (altEl) altEl.textContent = alt;
  }
  // Stats
  const fpsEl = overlay.querySelector('#sim-fps');
  const memEl = overlay.querySelector('#sim-mem');
  if (fpsEl) fpsEl.textContent = window.__sim_fps || '--';
  if (memEl) memEl.textContent = window.__sim_mem || '--';
}

// --- Patch stats to update overlay ---
let lastFrame = performance.now();
let frames = 0;
let fps = 0;
setInterval(() => {
  frames++;
  const now = performance.now();
  if (now - lastFrame >= 1000) {
    fps = frames;
    frames = 0;
    lastFrame = now;
    window.__sim_fps = fps;
    window.__sim_mem = window.performance && performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) : 'N/A';
  }
  // Update overlay
  if (drone) updateSimOverlay('drone');
  else if (aircraft) updateSimOverlay('plane');
}, 500);

// --- Patch AI feedback panel update ---
function updateAIFeedbackPanel(text, controlJson) {
  const overlay = document.getElementById('sim-overlay');
  if (!overlay) return;
  const textDiv = overlay.querySelector('#ai-feedback-text');
  const jsonDiv = overlay.querySelector('#ai-feedback-json');
  if (textDiv) textDiv.textContent = text || '';
  if (jsonDiv) jsonDiv.textContent = controlJson ? JSON.stringify(controlJson, null, 2) : '';
}

// --- Patch init to use unified overlay ---
const originalInit = init;
init = function(params, vehicleType = 'plane') {
  originalInit(params, vehicleType);
  createSimOverlay(vehicleType);
};

// --- Drone Auto Takeoff ---
let droneTakeoffComplete = false;
let droneTakeoffTarget = 5; // units