const { PI, sqrt, sin, cos, tan, asin, acos, atan } = Math;
const TAU = PI * 2;

const SUN_DEF_RAD = 695660;
const SUN_DEF_DIST = 150e6;
const MOON_RAD = 1737.4;
const MOON_DEF_DIST = 3.844e5;

const EARTH_AVG_RAD = 6371.0088;
const EARTH_POL_RAD = 6356.7523;
const EARTH_EQT_RAD = 6378.1370;

const toRadian = (deg) => {
	return deg / 180 * PI;
};

const toDegree = (rad) => {
	return rad / PI * 180;
};

const VEC = {
	sum: ([ ax, ay, az ], [ bx, by, bz ]) => {
		return [ ax + bx, ay + by, az + bz ];
	},
	sub: ([ ax, ay, az ], [ bx, by, bz ]) => {
		return [ ax - bx, ay - by, az - bz ];
	},
	dot: ([ ax, ay, az ], [ bx, by, bz ]) => {
		return ax*bx + ay*by + az*bz;
	},
	scale: ([ x, y, z ], value) => {
		return [ x*value, y*value, z*value ];
	},
	length: ([ x, y, z ]) => {
		return sqrt(x**2 + y**2 + z**2);
	},
	dist: (a, b) => {
		return VEC.length(VEC.sub(a, b));
	},
	normalize: (vec) => {
		return VEC.scale(vec, 1/VEC.length(vec));
	},
	angle: (a, b) => {
		return acos(VEC.dot(a, b));
	},
	flip: (vec) => {
		return VEC.scale(vec, -1);
	},
	rotateX: ([ x, y, z ], angle) => {
		const s = sin(angle);
		const c = cos(angle);
		return [ x, y*c + z*s, z*c - y*s ];
	},
	rotateY: ([ x, y, z ], angle) => {
		const s = sin(angle);
		const c = cos(angle);
		return [ x*c - z*s, y, z*c + x*s ];
	},
	rotateZ: ([ x, y, z ], angle) => {
		const s = sin(angle);
		const c = cos(angle);
		return [ x*c + y*s, y*c - x*s, z ];
	},
};

const ellipseDerivative = (x, A, B) => {
	return - x * B / (A**2 * sqrt(1 - (x/A) ** 2));
};

const ellipseRounder = ([ x, y, z ]) => {
	const eq = EARTH_AVG_RAD/EARTH_EQT_RAD;
	const po = EARTH_AVG_RAD/EARTH_POL_RAD;
	return [ x*eq, y*eq, z*po ];
};

const ellipseInvRounder = ([ x, y, z ]) => {
	const eq = EARTH_EQT_RAD/EARTH_AVG_RAD;
	const po = EARTH_POL_RAD/EARTH_AVG_RAD;
	return [ x*eq, y*eq, z*po ];
};

const dirToLatLon = ([ x, y, z ]) => {
	const lat = asin(z);
	const f = sqrt(x**2 + y**2);
	const lon = f > 0 ? acos(x/f) * (y < 0? -1: 1) : 0;
	return [ lat, lon ];
};

export const SPHERE_MODEL = {
	rayIntersection: (start, dir) => {
		const earth = VEC.flip(start);
		const tMid = VEC.dot(earth, dir);
		const midPoint = VEC.sum(start, VEC.scale(dir, tMid));
		const midPointDist = VEC.length(midPoint);
		if (midPointDist > EARTH_AVG_RAD) {
			return null;
		}
		const offset = sqrt(EARTH_AVG_RAD**2 - midPointDist**2);
		const distance = tMid - offset;
		const point = VEC.sum(start, VEC.scale(dir, distance));
		return { point, distance };
	},
	surfaceVecToLatLon: (vec) => {
		return dirToLatLon(VEC.normalize(vec));
	},
};

export const ELLIPSOID_MODEL = {
	rayIntersection: (start, dir) => {
		const intersection = SPHERE_MODEL.rayIntersection(
			ellipseRounder(start),
			VEC.normalize(ellipseRounder(dir)),
		);
		if (intersection == null) {
			return null;
		}
		const point = ellipseInvRounder(intersection.point);
		const distance = VEC.dist(start, point);
		return { point, distance };
	},
	surfaceVecToLatLon: (vec) => {
		const [ x, y, z ] = vec;
		const f = sqrt(x**2 + y**2);
		const s = ellipseDerivative(z, EARTH_POL_RAD, EARTH_EQT_RAD);
		const lat = atan(-s);
		const lon = f > 0 ? acos(x/f) * (y < 0? -1: 1) : 0;
		return [ lat, lon ];
	},
};

const ghaDecToDir = (gha, dec) => {
	const cosDec = cos(dec);
	return [ cosDec*cos(gha), cosDec*-sin(gha), sin(dec) ];
};

const ghaDecDistToVec = (gha, dec, dist) => {
	return VEC.scale(ghaDecToDir(gha, dec), dist);
};

const calcUmbraDist = (sunRad, dist) => {
	const dRad = sunRad - MOON_RAD;
	return dist * (sunRad / dRad - 1);
};

const longToGHA = (lon) => {
	return (TAU - lon) % TAU;
};

const calcUmbraAngle = (sunRad, dist) => {
	return asin((sunRad - MOON_RAD)/dist);
};

const calcPenmbraAngle = (sunRad, dist) => {
	return - asin((sunRad + MOON_RAD)/dist);
};

const buildShadowEdgeRay = (sun, sunRad, moon, azimuth, calcAngle) => {
	const angle = calcAngle(sunRad, VEC.dist(sun, moon));
	const [ sunLat, sunLon ] = dirToLatLon(VEC.normalize(VEC.sub(sun, moon)));
	
	let dir = VEC.rotateY([ -1, 0, 0 ], angle);
	dir = VEC.rotateX(dir, azimuth);
	dir = VEC.rotateY(dir, sunLat);
	dir = VEC.rotateZ(dir, - sunLon);
	
	let start = VEC.rotateY([ 0, 0, MOON_RAD ], angle);
	start = VEC.rotateX(start, azimuth);
	start = VEC.rotateY(start, sunLat);
	start = VEC.rotateZ(start, - sunLon);
	start = VEC.sum(start, moon);

	return { start, dir };
};

export class EclipseEngine {
	constructor() {
		this.model = ELLIPSOID_MODEL;
		this.sunGHA = 0;
		this.sunDec = 0;
		this.sunDist = SUN_DEF_DIST;
		this.sunRad = SUN_DEF_RAD;
		this.moonGHA = 0;
		this.moonDec = 0;
		this.moonDist = MOON_DEF_DIST;
	}
	setSunGHADec(gha, dec) {
		this.sunGHA = toRadian(gha);
		this.sunDec = toRadian(dec);
		return this;
	}
	setSunGP(lat, long) {
		this.sunGHA = longToGHA(toRadian(long));
		this.sunDec = toRadian(lat);
		return this;
	}
	setSunDist(dist) {
		this.sunDist = dist;
		return this;
	}
	calcSunVec() {
		const { sunGHA, sunDec, sunDist } = this;
		return ghaDecDistToVec(sunGHA, sunDec, sunDist);
	}
	setMoonGHADec(gha, dec) {
		this.moonGHA = toRadian(gha);
		this.moonDec = toRadian(dec);
		return this;
	}
	setMoonGP(lat, long) {
		this.moonGHA = longToGHA(toRadian(long));
		this.moonDec = toRadian(lat);
		return this;
	}
	setMoonDist(dist) {
		this.moonDist = dist;
		return this;
	}
	setMoonHP(hp) {
		this.moonDist = EARTH_AVG_RAD/tan(toRadian(hp));
		return this;
	}
	calcMoonVec() {
		const { moonGHA, moonDec, moonDist } = this;
		return ghaDecDistToVec(moonGHA, moonDec, moonDist);
	}
	calcShadowCenter() {
		const { model } = this;
		const sun = this.calcSunVec();
		const moon = this.calcMoonVec();
		const dir = VEC.normalize(VEC.sub(moon, sun));
		const intersection = model.rayIntersection(moon, dir);
		if (intersection == null) {
			return null;
		}
		const sunDist = VEC.dist(sun, moon);
		const umbraDist = calcUmbraDist(this.sunRad, sunDist);
		const type = intersection.distance > umbraDist ? 'ANULAR' : 'TOTAL';
		const location = model.surfaceVecToLatLon(intersection.point).map(toDegree);
		return { location, type };
	}
	calcUmbraEdgePoint(azimuth) {
		const { model } = this;
		const sun = this.calcSunVec();
		const moon = this.calcMoonVec();
		const edgeRay = buildShadowEdgeRay(sun, this.sunRad, moon, toRadian(azimuth), calcUmbraAngle);
		const intersection = model.rayIntersection(edgeRay.start, edgeRay.dir);
		if (intersection == null) {
			return null;
		}
		return model.surfaceVecToLatLon(intersection.point).map(toDegree);
	}
	calcPenumbraEdgePoint(azimuth) {
		const { model } = this;
		const sun = this.calcSunVec();
		const moon = this.calcMoonVec();
		const edgeRay = buildShadowEdgeRay(sun, this.sunRad, moon, toRadian(azimuth), calcPenmbraAngle);
		const intersection = model.rayIntersection(edgeRay.start, edgeRay.dir);
		if (intersection == null) {
			return null;
		}
		return model.surfaceVecToLatLon(intersection.point).map(toDegree);
	}
}
