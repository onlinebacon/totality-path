const { sqrt } = Math;

class Vec {
	constructor(x, y, z) {
		this.x = x;
		this.y = y;
		this.z = z;
	}
	plus({ x, y, z }) {
		return new Vec(this.x + x, this.y + y, this.z + z);
	}
	minus({ x, y, z }) {
		return new Vec(this.x - x, this.y - y, this.z - z);
	}
	mul(val) {
		return new Vec(this.x*val, this.y*val, this.z*val);
	}
	div(val) {
		return new Vec(this.x/val, this.y/val, this.z/val);
	}
	mag() {
		return sqrt(this.x**2 + this.y**2 + this.z**2);
	}
	normalize() {
		return this.div(this.mag());
	}
	dot({ x, y, z }) {
		return this.x*x + this.y*y + this.z*z;
	}
}

export default Vec;
