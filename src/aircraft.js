// Thank you for using and improving this flight simulator! :)
import * as THREE from 'three';
import { updateFlight } from './flightlogic.js';
import { PID } from './pid.js';

export class Aircraft {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;

    // Aerodynamic Airplane Model
    const airplane = new THREE.Group();

    // Fuselage (cylinder)
    const fuselageGeo = new THREE.CylinderGeometry(0.3, 0.4, 3.5, 16);
    const fuselageMat = new THREE.MeshStandardMaterial({ color: config.color });
    const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
    fuselage.rotation.x = Math.PI / 2;
    airplane.add(fuselage);

    // Wings (thin boxes)
    const wingGeo = new THREE.BoxGeometry(5, 0.12, 1.2);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(0, 0, 0);
    airplane.add(wing);

    // Horizontal stabilizer (tail wing)
    const hTailGeo = new THREE.BoxGeometry(0.8, 0.05, 0.25);
    const hTail = new THREE.Mesh(hTailGeo, wingMat);
    hTail.position.set(0, 0, -1.5);
    airplane.add(hTail);

    // Vertical stabilizer (tail fin)
    const vTailGeo = new THREE.BoxGeometry(0.05, 0.3, 0.25);
    const vTail = new THREE.Mesh(vTailGeo, wingMat);
    vTail.position.set(0, 0.15, -1.5);
    airplane.add(vTail);

    this.mesh = airplane;

    // Flight physics
    this.velocity = new THREE.Vector3(0, 0, 0); // x, y, z
    this.lift = 0;
    this.gravity = -0.01; // gravity force
    this.mass = 1;
    this.grounded = true;

    // PID controllers (conservative defaults)
    this.pidPitch = new PID(0.5, 0.0, 0.1, 0.1, -0.02, 0.02);
    this.pidRoll = new PID(0.5, 0.0, 0.1, 0.1, -0.02, 0.02);
    this.pidYaw = new PID(0.3, 0.0, 0.05, 0.1, -0.01, 0.01);
    this.pidThrottle = new PID(0.2, 0.0, 0.05, 0.1, -0.005, 0.005);

    // Targets for stabilization
    this.targetPitch = -0.1; // slight nose up for lift
    this.targetRoll = 0; // level
    this.targetYaw = 0; // initial heading
    this.targetAltitude = 500 / 3.28; // 500 ft in units
    this.targetThrottle = 0.5;
  }

  // For manual override, you can still call these
  pitch(delta) { this._manualPitch = delta; }
  yaw(delta) { this._manualYaw = delta; }
  roll(delta) { this._manualRoll = delta; }

  update(throttle) {
    // Get current orientation (Euler angles from quaternion)
    const euler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
    let pitch = euler.x;
    const roll = euler.z;
    const yaw = euler.y;
    const altitude = this.mesh.position.y;

    // Clamp pitch to ±0.52 radians (±30 degrees)
    if (pitch > 0.52) pitch = 0.52;
    if (pitch < -0.52) pitch = -0.52;

    // PID outputs
    let pitchDelta = this.pidPitch.update(this.targetPitch, pitch);
    let rollDelta = this.pidRoll.update(this.targetRoll, roll);
    let yawDelta = this.pidYaw.update(this.targetYaw, yaw);
    let throttleDelta = this.pidThrottle.update(this.targetAltitude, altitude);

    // Clamp altitude to minimum 500 ft
    if (altitude < 500 / 3.28) {
      this.targetAltitude = 500 / 3.28;
      throttleDelta = Math.abs(throttleDelta); // force climb
    }

    // Apply manual overrides if present
    if (this._manualPitch) pitchDelta += this._manualPitch;
    if (this._manualRoll) rollDelta += this._manualRoll;
    if (this._manualYaw) yawDelta += this._manualYaw;
    this._manualPitch = 0;
    this._manualRoll = 0;
    this._manualYaw = 0;

    // Apply quaternion-based rotation (local axes)
    const q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawDelta);
    this.mesh.quaternion.multiply(q);
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchDelta);
    this.mesh.quaternion.multiply(q);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rollDelta);
    this.mesh.quaternion.multiply(q);

    // Update throttle for altitude hold
    const newThrottle = Math.max(0, Math.min(1, throttle + throttleDelta));
    updateFlight(this, newThrottle);
  }
}