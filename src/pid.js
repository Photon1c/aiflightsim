export class PID {
  constructor(kp = 1, ki = 0, kd = 0, dt = 0.1, min = -Infinity, max = Infinity) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this.dt = dt;
    this.min = min;
    this.max = max;
    this.integral = 0;
    this.prevError = 0;
  }

  reset() {
    this.integral = 0;
    this.prevError = 0;
  }

  update(setpoint, measured) {
    const error = setpoint - measured;
    this.integral += error * this.dt;
    const derivative = (error - this.prevError) / this.dt;
    this.prevError = error;
    let output = this.kp * error + this.ki * this.integral + this.kd * derivative;
    output = Math.max(this.min, Math.min(this.max, output));
    return output;
  }
} 