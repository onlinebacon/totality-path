import ANGLE from "./angle.js";
import { EclipseEngine } from "./eclipse-engine.js";

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = MIN * 60;

const engine = new EclipseEngine();

const almanacLines = `
	16 |  59 35.1 | 7 33.4 |  60 56.8 | 7 13.9 | 1 0.9
	17 |  74 35.3 | 7 34.3 |  75 25.6 | 7 31.4 | 1 0.9
	18 |  89 35.5 | 7 35.2 |  89 54.4 | 7 48.9 | 1 0.9
	19 | 104 35.6 | 7 36.2 | 104 23.2 | 8 06.3 | 1 0.9
	20 | 119 35.8 | 7 37.1 | 118 51.9 | 8 23.6 | 1 0.8
`;

const data = almanacLines.trim().split(/\n/).map(line => {
	const [ hour, ...values ] = line.trim().split(/\s*\|\s*/);
	const [ sunGHA, sunDec, moonGHA, moonDec, moonHP ] = values.map(ANGLE.parse);
	return { time: hour * HOUR, sunGHA, sunDec, moonGHA, moonDec, moonHP };
});

const dataAt = (time) => {
	for (let i=1; i<data.length; ++i) {
		const bef = data[i - 1];
		const aft = data[i];
		if (time < bef.time || time > aft.time) {
			continue;
		}
		const t = (time - bef.time)/(aft.time - bef.time);
		const res = {};
		for (const key in bef) {
			res[key] = bef[key] + t * (aft[key] - bef[key]);
		}
		return res;
	}
	return null;
};

const setTime = (time) => {
	const data = dataAt(time);
	engine.setSunGHADec(data.sunGHA, data.sunDec);
	engine.setMoonGHADec(data.moonGHA, data.moonDec);
	engine.setMoonHP(data.moonHP);
};

const startTime = data[0].time;
const endTime = data.at(-1).time;

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const img = document.createElement('img');

const locationToMapPos = ([ lat, lon ]) => {
	const x = (lon/360 + 0.5) * canvas.width;
	const y = (0.5 - lat/180) * canvas.height;
	return [ x, y ];
};

const forEachPathPoint = (start, end, interval, it) => {
	for (let time = start; time <= end; time += interval) {
		setTime(time);
		const shadow = engine.calcShadowCenter();
		if (shadow === null) {
			continue;
		}
		const point = locationToMapPos(shadow.location);
		it(time, point);
	}
};

const timeToStrHourMin = (time) => {
	const tMin = Math.round(time / MIN);
	const min = tMin % 60;
	const hour = (tMin - min) / 60;
	return `${
		hour.toString().padStart(2, '0')
	}:${
		min.toString().padStart(2, '0')
	}`;
};

const drawMap = () => {
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
};

const dot = ([ x, y ], r) => {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI*2);
	ctx.fill();
};

const plotPath = () => {
	const s = canvas.width * 0.001;
	
	ctx.strokeStyle = '#0bf';
	ctx.lineWidth = s;
	let first = true;
	ctx.beginPath();
	forEachPathPoint(startTime, endTime, 10 * SEC, (time, [ x, y ]) => {
		if (first) {
			ctx.moveTo(x, y);
			first = false;
		} else {
			ctx.lineTo(x, y);
		}
	});
	ctx.stroke();

	ctx.fillStyle = '#000';
	ctx.textAlign = 'right';
	ctx.font = 'bold ' + (s * 6) + 'px arial';
	forEachPathPoint(startTime, endTime, 10 * MIN, (time, pos) => {
		dot(pos, s);
		const [ x, y ] = pos;
		ctx.fillText(timeToStrHourMin(time), x - s * 2, y - s * 2);
	});
};

const plotUmbra = () => {
	ctx.fillStyle = 'rgb(0, 0, 0, 0.25)';
	ctx.beginPath();
	let first = false;
	for (let i=0; i<360; ++i) {
		const loc = engine.calcUmbraEdgePoint(i);
		if (loc == null) {
			continue;
		}
		const pos = locationToMapPos(loc);
		if (first) {
			ctx.moveTo(...pos);
			first = false;
		} else {
			ctx.lineTo(...pos);
		}
	}
	ctx.fill();
};

const plotPenumbra = () => {
	ctx.fillStyle = 'rgb(0, 0, 0, 0.1)';
	ctx.beginPath();
	let first = false;
	for (let i=0; i<360; ++i) {
		const loc = engine.calcPenumbraEdgePoint(i);
		if (loc == null) {
			continue;
		}
		const pos = locationToMapPos(loc);
		if (first) {
			ctx.moveTo(...pos);
			first = false;
		} else {
			ctx.lineTo(...pos);
		}
	}
	ctx.fill();
};

img.onload = () => {
	drawMap();
	setTime(18*HOUR + 36*MIN + 13.8*SEC);
	plotPenumbra();
	plotUmbra();
	plotPath();
};

img.src = './map.png';
