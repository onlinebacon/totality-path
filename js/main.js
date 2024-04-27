import ANGLE from "./angle.js";
import { animate } from "./animate.js";
import { ELLIPSOID, SPHERE, calcPenumbraEdgePoint, calcShadowCenter, calcUmbraEdgePoint, latLonDistToVec } from "./eclipse.js";

let model = ELLIPSOID;
const models = {
	ellipsoid: ELLIPSOID,
	sphere: SPHERE,
};

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

const project = (lat, lon) => {
	const x = (lon / (Math.PI * 2) + 0.5) * canvas.width;
	const y = (0.5 - lat / Math.PI) * canvas.height;
	return [ x, y ];
};

const pointToCoord = (x, y) => {
	const lon = (x / canvas.width - 0.5) * Math.PI*2;
	const lat = (0.5 - y / canvas.height) * Math.PI;
	return [ lat, lon ].map(x => (x/Math.PI*180).toFixed(6)).join(', ');
};

const timeRangeInput = document.querySelector('input');

let lines = [];
let start;
let end;
let time;

const setInputData = (raw) => {
	lines = raw.trim().split(/\n/).map(line => {
		const cols = line.trim().split(/\s*\|\s*/);
		const [ hour, ...values ] = cols;
		const [ sunGHA, sunDec, moonGHA, moonDec, moonHP ] = values.map(ANGLE.parse);
		const time = Number(hour) * HOUR;
		const moonDist = SPHERE.radius / Math.tan(moonHP);
		return { time, sunGHA, sunDec, moonGHA, moonDec, moonDist };
	});
	start = lines[0].time;
	end = lines.at(-1).time;
	time = start;
	timeRangeInput.min = Math.floor(start/MIN);
	timeRangeInput.max = Math.floor(end/MIN);
	timeRangeInput.step = 1;
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
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
};

const getShadowCenterAt = (time) => {
	const { sunGHA, sunDec, moonGHA, moonDec, moonDist } = dataAt(time);
	const sunVec = latLonDistToVec(sunDec, - sunGHA, 150e6);
	const moonVec = latLonDistToVec(moonDec, - moonGHA, moonDist);
	const shadow = calcShadowCenter(model, sunVec, moonVec);
	if (shadow == null) {
		return null;
	}
	const [ lat, lon ] = shadow.gp;
	return project(lat, lon);
};

const strTime = (time) => {
	const tMin = Math.floor(time / MIN);
	const min = tMin % 60;
	const tHrs = (tMin - min) / 60;
	return `${
		tHrs.toString().padStart(2, '0')
	}:${
		min.toString().padStart(2, '0')
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
	const sunVec = latLonDistToVec(sunDec, - sunGHA, 150e6);
	const moonVec = latLonDistToVec(moonDec, - moonGHA, moonDist);
	ctx.beginPath();
	let started = false;
	for (let i=0; i<n; ++i) {
		const angle = i / n * Math.PI * 2;
		const gp = fn(model, sunVec, moonVec, angle);
		if (gp == null) {
			started = false;
			continue;
		}
		const [ lat, lon ] = gp;
		const [ x, y ] = project(lat, lon);
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
	drawShadowAt(time, 'rgba(0, 0, 0, 0.2)', 3600, calcPenumbraEdgePoint);
	drawShadowAt(time, 'rgba(0, 0, 0, 0.2)', 360, calcUmbraEdgePoint);
	drawPathLine(MIN);
	drawTimeStamps(10 * MIN);
	writeTime();
};

timeRangeInput.addEventListener('input', () => {
	time = Number(timeRangeInput.value) * MIN;
	render();
});

window.addEventListener('keydown', e => {
	if (/^numpad?enter$/i.test(e.code)) {
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
