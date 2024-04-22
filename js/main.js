import ANGLE from "./angle.js";
import { ELLIPSOID, calcShadowCenter, latLonDistToVec } from "./eclipse.js";

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

const almanacInputLines = `
	16 |  59° 35.1' | 7° 33.4' |  60° 56.8' | 7° 13.9' | 60.9'
	17 |  74° 35.3' | 7° 34.3' |  75° 25.6' | 7° 31.4' | 60.9'
	18 |  89° 35.5' | 7° 35.2' |  89° 54.4' | 7° 48.9' | 60.9'
	19 | 104° 35.6' | 7° 36.2' | 104° 23.2' | 8° 06.3' | 60.9'
	20 | 119° 35.8' | 7° 37.1' | 118° 51.9' | 8° 23.6' | 60.8'
`;

const lines = almanacInputLines.trim().split(/\n/).map(line => {
	const cols = line.trim().split(/\s*\|\s*/);
	const [ hour, ...values ] = cols;
	const [ sunGHA, sunDec, moonGHA, moonDec, moonHP ] = values.map(ANGLE.parse);
	const time = Number(hour) * HOUR;
	return { time, sunGHA, sunDec, moonGHA, moonDec, moonHP };
});

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
ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

const getShadowCenterAt = (time) => {
	const { sunGHA, sunDec, moonGHA, moonDec, moonHP } = dataAt(time);
	const moonDist = 6371.0088 / Math.tan(moonHP);
	const sunVec = latLonDistToVec(sunDec, - sunGHA, 150e6);
	const moonVec = latLonDistToVec(moonDec, - moonGHA, moonDist);
	const shadow = calcShadowCenter(ELLIPSOID, sunVec, moonVec);
	if (shadow == null) {
		return null;
	}
	const [ lat, lon ] = shadow.gp;
	return project(lat, lon);
};

const start = lines[0].time;
const end = lines.at(-1).time;

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

drawPathLine(MIN);
drawTimeStamps(5 * MIN);
