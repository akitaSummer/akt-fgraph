export default class SmoothFollow {
  mass: number;
  value: number;
  valueSmooth: number;
  pristine: boolean;

  constructor(value = 0.0, mass = 0.2) {
    this.mass = mass;
    this.value = value;
    this.valueSmooth = value;
    this.pristine = true;

    return this;
  }

  setMass(mass: number) {
    this.mass = mass;
    if (this.mass < 0) {
      this.mass = 0;
    }

    return this;
  }

  set(value: number) {
    if (this.pristine) {
      this.pristine = false;
      this.reset(value);
    } else {
      this.value = value;
    }
  }

  get() {
    return this.value;
  }

  reset(value: number) {
    this.value = value;
    this.valueSmooth = value;
  }

  getSmooth() {
    return this.valueSmooth;
  }

  interpolateLinear(value0: number, value1: number, pos: number) {
    return value0 + pos * (value1 - value0);
  }

  loop(deltaTime: number) {
    if (this.mass === 0) {
      this.valueSmooth = this.value;
    } else {
      this.valueSmooth = this.interpolateLinear(
        this.valueSmooth,
        this.value,
        deltaTime / this.mass
      );
    }

    return this;
  }

  toString() {
    return (
      "SmoothFollow | value: " +
      this.value +
      ", valueSmooth: " +
      this.valueSmooth
    );
  }
}
