import * as THREE from 'three';

export function updateFlight(aircraft, throttle) {
  // Tuned Parameters
  const gravity = -0.012; // slightly reduced gravity
  const drag = 0.995;
  const liftPower = 0.08; // reduced lift for larger wings
  const minTakeoffSpeed = 0.12; // lower min speed for lift
  const minPitch = 0.01;
  const groundLevel = 0.25;
  const ceiling = 200; // max altitude

  // Forward speed
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.mesh.quaternion);
  const speed = throttle * 1.5;
  aircraft.velocity.x = forward.x * speed;
  aircraft.velocity.z = forward.z * speed;

  // Angle of attack (pitch)
  const pitch = aircraft.mesh.rotation.x; // negative is nose up

  // Calculate lift: only when nose is up (pitch < -minPitch)
  let lift = 0;
  if (speed > minTakeoffSpeed && pitch < -minPitch) {
    lift = liftPower * speed * -pitch;
  }

  // Apply lift and gravity
  aircraft.velocity.y += lift + gravity;
  aircraft.velocity.y *= drag;

  // Debug logs
  // if (window._frameCount && window._frameCount % 60 === 0) {
  //   console.log('Lift:', lift.toFixed(4), 'VertVel:', aircraft.velocity.y.toFixed(4), 'Pitch:', pitch.toFixed(4), 'Speed:', speed.toFixed(4));
  // }

  // Update position
  aircraft.mesh.position.add(aircraft.velocity);

  // Clamp altitude to ceiling
  if (aircraft.mesh.position.y > ceiling) {
    aircraft.mesh.position.y = ceiling;
    aircraft.velocity.y = Math.min(0, aircraft.velocity.y);
  }

  // Ground collision and clamping
  if (aircraft.mesh.position.y <= groundLevel && aircraft.velocity.y <= 0) {
    aircraft.mesh.position.y = groundLevel;
    aircraft.velocity.y = 0;
    aircraft.grounded = true;
  } else {
    aircraft.grounded = false;
  }
} 