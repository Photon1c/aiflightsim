export function setupControls(config, onUpdate) {
  const keys = {};
  document.addEventListener('keydown', e => keys[e.code] = true);
  document.addEventListener('keyup', e => keys[e.code] = false);

  setInterval(() => {
    const delta = {
      pitch: 0,
      yaw: 0,
      roll: 0,
      throttle: 0
    };

    if (keys['ArrowUp']) delta.pitch -= config.pitchSpeed;
    if (keys['ArrowDown']) delta.pitch += config.pitchSpeed;
    if (keys['ArrowLeft']) delta.yaw -= config.yawSpeed;
    if (keys['ArrowRight']) delta.yaw += config.yawSpeed;
    if (keys['KeyA']) delta.roll += config.rollSpeed;
    if (keys['KeyD']) delta.roll -= config.rollSpeed;
    if (keys['KeyW']) delta.throttle += config.throttleIncrement;
    if (keys['KeyS']) delta.throttle -= config.throttleIncrement;

    onUpdate(delta);
  }, 100);
}