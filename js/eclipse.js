import ANGLE from "./angle.js";
import Vec from "./vec.js";

const { abs, sqrt, sin, cos, tan, asin, atan } = Math;

const EARTH_AVG_RAD = 6371.0088;
const EARTH_POL_RAD = 6356.7523;
const EARTH_EQT_RAD = 6378.1370;
const SUN_RAD  = 695780;
const MOON_RAD = 1737.4;

export const TOTAL = 'TOTAL';
export const ANULAR = 'ANULAR';

const ellipseDerivative = (x, a, b) => {
	return - b * x / (a**2 * sqrt(1 - (x/a)**2));
};

const calcUmbraDist = (sunMoonDist) => {
	return (SUN_RAD / (SUN_RAD - MOON_RAD) - 1) * sunMoonDist;
};

const dirToLatLon = ({ x, y, z }) => {
	const lon = ANGLE.calcSigned(x, y);
	const lat = asin(z);
	return [ lat, lon ];
};

const latLonToDir = ([ lat, lon ]) => {
	const x = cos(lat)*cos(lon);
	const y = cos(lat)*sin(lon);
	const z = sin(lat);
	return new Vec(x, y, z);
};

export const SPHERE = {
	radius: EARTH_AVG_RAD,
	rayIntersection: (start = new Vec(), dir = new Vec()) => {
		const tMid = - start.dot(dir);
		const midPoint = start.plus(dir.mul(tMid));
		const midDist = midPoint.mag();
		if (midDist > EARTH_AVG_RAD || tMid < 0) {
			return null;
		}
		const delta = sqrt(EARTH_AVG_RAD**2 - midDist**2);
		const dist = tMid - delta;
		return start.plus(dir.mul(dist));
	},
	gpVecToLatLon: (vec = new Vec()) => {
		return dirToLatLon(vec.normalize());
	},
	gpLatLonToVec: (coord = [ 0, 0 ]) => {
		return latLonToDir(coord).mul(EARTH_AVG_RAD);
	},
};

export const ELLIPSOID = {
	rayIntersection: (start = new Vec(), dir = new Vec()) => {
		const eq = EARTH_AVG_RAD/EARTH_EQT_RAD;
		const po = EARTH_AVG_RAD/EARTH_POL_RAD;
		start = new Vec(start.x*eq, start.y*eq, start.z*po);
		dir = new Vec(dir.x*eq, dir.y*eq, dir.z*po).normalize();
		const intersection = SPHERE.rayIntersection(start, dir);
		if (intersection == null) {
			return null;
		}
		const { x, y, z } = intersection;
		return new Vec(x/eq, y/eq, z/eq);
	},
	gpVecToLatLon: ({ x, y, z }) => {
		const lon = ANGLE.calcSigned(x, y);
		const s = ellipseDerivative(z, EARTH_POL_RAD, EARTH_EQT_RAD);
		const lat = atan(-s);
		return [ lat, lon ];
	},
	gpLatLonToVec: ([ lat, lon ]) => {
		const s = abs(tan(lat) / EARTH_EQT_RAD * EARTH_POL_RAD);
		const tf = 1 / sqrt(1 + s**2);
		const tz = sqrt(1 - tf**2) * (lat < 0? -1: 1);
		const x = cos(lon)*tf*EARTH_EQT_RAD;
		const y = sin(lon)*tf*EARTH_EQT_RAD;
		const z = tz*EARTH_POL_RAD;
		return new Vec(x, y, z);
	},
};

export const latLonDistToVec = (lat, lon, dist) => {
	const x = cos(lat)*cos(lon)*dist;
	const y = cos(lat)*sin(lon)*dist;
	const z = sin(lat)*dist;
	return new Vec(x, y, z);
};

export const calcShadowCenter = (model = SPHERE, sunVec = new Vec(), moonVec = new Vec()) => {
	const intersection = model.rayIntersection(
		moonVec,
		moonVec.minus(sunVec).normalize(),
	);
	if (intersection == null) {
		return null;
	}
	const gp = model.gpVecToLatLon(intersection);
	const sunMoonDist = sunVec.minus(moonVec).mag();
	const dist = intersection.minus(moonVec).mag();
	const type = dist > calcUmbraDist(sunMoonDist) ? ANULAR : TOTAL;
	return { gp, type };
};

const calcUmbraAngle = (sunMoonDist) => {
	return asin((SUN_RAD - MOON_RAD)/sunMoonDist);
};

const calcPenumbraAngle = (sunMoonDist) => {
	return - asin((SUN_RAD + MOON_RAD)/sunMoonDist);
};

const calcShadowEdgePoint = (
	model = SPHERE,
	sunVec = new Vec(),
	moonVec = new Vec(),
	shadowAngleFn = calcUmbraAngle,
	angle = 0,
) => {
	const moonToSun = sunVec.minus(moonVec);
	const sunMoonDist = moonToSun.mag();

	let start = new Vec( 0, 0, MOON_RAD);
	let dir   = new Vec(-1, 0, 0);
	
	const tilt = shadowAngleFn(sunMoonDist);

	start = start.rotY(tilt).rotX(angle);
	dir   = dir  .rotY(tilt).rotX(angle);

	const [ dirLat, dirLon ] = SPHERE.gpVecToLatLon(moonToSun);

	start = start.rotY(dirLat).rotZ(-dirLon).plus(moonVec);
	dir   = dir  .rotY(dirLat).rotZ(-dirLon);

	const point = model.rayIntersection(start, dir);
	if (point == null) {
		return null;
	}

	return model.gpVecToLatLon(point);
};

export const calcUmbraEdgePoint = (
	model = SPHERE,
	sunVec = new Vec(),
	moonVec = new Vec(),
	angle = 0,
) => {
	return calcShadowEdgePoint(
		model,
		sunVec,
		moonVec,
		calcUmbraAngle,
		angle,
	);
};

export const calcPenumbraEdgePoint = (
	model = SPHERE,
	sunVec = new Vec(),
	moonVec = new Vec(),
	angle = 0,
) => {
	return calcShadowEdgePoint(
		model,
		sunVec,
		moonVec,
		calcPenumbraAngle,
		angle,
	);
};
