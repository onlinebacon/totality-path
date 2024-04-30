let scale = 1;
let dx = 0;
let dy = 0;
let width = 1200;
let height = 600;

export const setSize = (x, y) => {
	width = x;
	height = y;
};

export const pointToNormal = ([ x, y ]) => {
	return [ x/width, y/height ];
};

export const normalToPoint = ([ x, y ]) => {
	return [ x*width, y*height ];
};

export const applyZoom = ([ x, y ]) => {
	return [ x*scale + dx, y*scale + dy ];
};

export const revertZoom = ([ x, y ]) => {
	return [ (x - dx)/scale, (y - dy)/scale ];
};

export const normalToLatLon = ([ x, y ]) => {
	return [ (0.5 - y)*Math.PI, (x - 0.5)*Math.PI*2 ];
};

export const latLonToNormal = ([ lat, lon ]) => {
	return [ 0.5 + lon/(Math.PI*2), 0.5 - lat/Math.PI ];
};

const keepInsideTheBox = () => {
	if (scale < 1) {
		scale = 1;
	}
	dx = Math.min(dx, 0);
	dy = Math.min(dy, 0);
	if ((1 - dx)/scale > 1) dx = 1 - scale;
	if ((1 - dy)/scale > 1) dy = 1 - scale;
};

export const zoomAt = (point, val) => {
	const normal = pointToNormal(point);
	const [ nx, ny ] = normal;
	const [ vx, vy ] = revertZoom(normal);
	const s = scale*val;
	dx = nx - vx*s;
	dy = ny - vy*s;
	scale = s;
	keepInsideTheBox();
};
