import ANGLE from "./angle.js";
import { animate } from "./animate.js";
import * as ECLIPSE from "./eclipse.js";
import * as NAV from "./navigate.js";

const models = {
	ellipsoid: ECLIPSE.ELLIPSOID,
	sphere:    ECLIPSE.SPHERE,
};

let model = models.ellipsoid;

const SEC  = 1000;
const MIN  = 60 * SEC;
const HOUR = 60 * MIN;

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const loadImage = (src) => new Promise((done, fail) => {
	const img = document.createElement('img');
	img.onload = () => done(img);
	img.onerror = (err) => fail(err);
	img.src = src;
});

const dot = (x, y) => {
	ctx.beginPath();
	ctx.arc(x, y, 1.5, 0, Math.PI*2);
	ctx.fill();
};

const timeRangeInput = document.querySelector('input');

let lines = [];
let start;
let end;
let time;
let inspect = null;

const setInputData = (raw) => {
	lines = raw.trim().split(/\n/).map(line => {
		const cols = line.trim().split(/\s*\|\s*/);
		const [ hour, ...values ] = cols;
		const [ sunGHA, sunDec, moonGHA, moonDec, moonHP ] = values.map(ANGLE.parse);
		const time = Number(hour) * HOUR;
		const moonDist = models.sphere.radius / Math.tan(moonHP);
		return { time, sunGHA, sunDec, moonGHA, moonDec, moonDist };
	});
	start = lines[0].time;
	end = lines.at(-1).time;
	timeRangeInput.min = Math.floor(start/MIN);
	timeRangeInput.max = Math.floor(end/MIN);
	timeRangeInput.step = SEC/MIN;
	time = timeRangeInput.value * MIN;
};

const almanacInputLines = `
	15 |  44° 35.0' | 7° 32.4' |  46° 27.9' | 6° 56.4' | 60.9'
	16 |  59° 35.1' | 7° 33.4' |  60° 56.8' | 7° 13.9' | 60.9'
	17 |  74° 35.3' | 7° 34.3' |  75° 25.6' | 7° 31.4' | 60.9'
	18 |  89° 35.5' | 7° 35.2' |  89° 54.4' | 7° 48.9' | 60.9'
	19 | 104° 35.6' | 7° 36.2' | 104° 23.2' | 8° 06.3' | 60.9'
	20 | 119° 35.8' | 7° 37.1' | 118° 51.9' | 8° 23.6' | 60.8'
	21 | 134° 36.0' | 7° 38.0' | 133° 20.6' | 8° 40.9' | 60.8'
`;

setInputData(almanacInputLines);

const dataAt = (time) => {
	for (let i=1; i<lines.length; ++i) {
		const a = lines[i - 1];
		const b = lines[i];
		if (time < a.time || time > b.time) {
			continue;
		}
		const t = (time - a.time)/(b.time - a.time);
		const res = { ...a };
		for (const key in res) {
			res[key] += t*(b[key] - a[key]);
		}
		return res;
	}
	return null;
};

const img = await loadImage('./map.png');

const drawMap = () => {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	const [ ax, ay ] = NAV.revertZoom([ 0, 0 ]);
	const [ bx, by ] = NAV.revertZoom([ 1, 1 ]);
	const sx = ax*img.width;
	const sy = ay*img.height;
	const sWidth = (bx - ax)*img.width;
	const sHeight = (by - ay)*img.height;
	ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
};

const getShadowCenterAt = (time) => {
	const { sunGHA, sunDec, moonGHA, moonDec, moonDist } = dataAt(time);
	const sunVec = ECLIPSE.latLonDistToVec(sunDec, - sunGHA, 150e6);
	const moonVec = ECLIPSE.latLonDistToVec(moonDec, - moonGHA, moonDist);
	const shadow = ECLIPSE.calcShadowCenter(model, sunVec, moonVec);
	if (shadow == null) {
		return null;
	}
	return NAV.normalToPoint(NAV.applyZoom(NAV.latLonToNormal(shadow.gp)));
};

const strTime = (time) => {
	const tSec = Math.round(time / SEC);
	const sec = tSec % 60;
	const tMin = (tSec - sec) / 60;
	const min = tMin % 60;
	const tHrs = (tMin - min) / 60;
	const hrs = tHrs;
	return `${
		hrs.toString().padStart(2, '0')
	}:${
		min.toString().padStart(2, '0')
	}:${
		sec.toString().padStart(2, '0')
	}`;
};

const drawPathLine = (interval) => {
	let started = false;
	ctx.lineWidth = 2;
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.beginPath();
	for (let time = start; time <= end; time += interval) {
		const point = getShadowCenterAt(time);
		if (point == null) {
			continue;
		}
		const [ x, y ] = point;
		if (!started) {
			started = true;
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	}
	ctx.stroke();
};

const drawTimeStamps = (interval) => {
	ctx.fillStyle = '#000';
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'left';
	ctx.font = '12px monospace';
	for (let time = start; time <= end; time += interval) {
		const point = getShadowCenterAt(time);
		if (point == null) {
			continue;
		}
		const [ x, y ] = point;
		dot(x, y);
		const [ ax, ay ] = getShadowCenterAt(time - SEC) ?? point;
		const [ bx, by ] = getShadowCenterAt(time + SEC) ?? point;
		const dx = bx - ax;
		const dy = by - ay;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(Math.PI/2 + Math.atan(dy/dx));
		ctx.fillText(strTime(time), 5, 0);
		ctx.restore();
	}
};

const drawShadowAt = (time, color, n, fn) => {
	ctx.strokeStyle = color;
	const { sunGHA, sunDec, moonGHA, moonDec, moonDist } = dataAt(time);
	const sunVec = ECLIPSE.latLonDistToVec(sunDec, - sunGHA, 150e6);
	const moonVec = ECLIPSE.latLonDistToVec(moonDec, - moonGHA, moonDist);
	ctx.beginPath();
	let started = false;
	for (let i=0; i<n; ++i) {
		const angle = i / n * Math.PI * 2;
		const gp = fn(model, sunVec, moonVec, angle);
		if (gp == null) {
			started = false;
			continue;
		}
		const [ x, y ] = NAV.normalToPoint(NAV.applyZoom(NAV.latLonToNormal(gp)));
		if (!started) {
			ctx.moveTo(x, y);
			started = true;
		} else {
			ctx.lineTo(x, y);
		}
	}
	ctx.stroke();
};

const writeTime = () => {
	ctx.fillStyle = '#000';
	ctx.textBaseline = 'bottom';
	ctx.font = '14px monospace';
	ctx.fillText(strTime(time), 10, canvas.height - 10);
};

const render = () => {
	drawMap();
	drawShadowAt(time, 'rgba(0, 0, 0, 0.2)', 3600, ECLIPSE.calcPenumbraEdgePoint);
	drawShadowAt(time, 'rgba(0, 0, 0, 0.2)', 360, ECLIPSE.calcUmbraEdgePoint);
	drawPathLine(MIN);
	drawTimeStamps(10 * MIN);
	writeTime();
};

timeRangeInput.addEventListener('input', () => {
	time = Number(timeRangeInput.value) * MIN;
	render();
});

window.addEventListener('keydown', e => {
	if (/^(numpad)?enter$/i.test(e.code)) {
		animate(5000, t => {
			timeRangeInput.value = time / MIN;
			time = start + (end - start)*t;
			render();
		})
	}
});

render();

const select = document.querySelector('select');
select.addEventListener('change', () => {
	model = models[select.value];
	render();
});

const textarea = document.querySelector('textarea');
textarea.value = almanacInputLines.trim().replace(/\s*\n\s*/g, '\n');
textarea.addEventListener('input', () => {
	setInputData(textarea.value);
	render();
});

canvas.addEventListener('wheel', e => {
	NAV.zoomAt([ e.offsetX, e.offsetY ], 1 - e.deltaY/1000);
	e.preventDefault();
	e.stopPropagation();
	e.stopImmediatePropagation();
	render();
});

canvas.addEventListener('dblclick', e => {
	const x = e.offsetX;
	const y = e.offsetY;
	const normal = NAV.revertZoom(NAV.pointToNormal([ x, y ]));
	inspect = NAV.normalToLatLon(normal);
});
