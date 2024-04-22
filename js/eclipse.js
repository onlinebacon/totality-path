import Vec from "./vec.js";

const { sqrt, sin, cos, asin, acos, atan } = Math;

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

export const SPHERE = {
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
		const { x, y, z } = vec.normalize();
		const f = sqrt(x**2 + y**2);
		const lat = asin(z);
		const lon = acos(x/f) * (y < 0? -1: 1);
		return [ lat, lon ];
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
		const f = sqrt(x**2 + y**2);
		const lon = acos(x/f) * (y < 0? -1: 1);
		const s = ellipseDerivative(z, EARTH_POL_RAD, EARTH_EQT_RAD);
		const lat = atan(-s);
		return [ lat, lon ];
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
