const toRadian = (deg) => {
	return deg / 180 * Math.PI;
};

const units = `°'"`;
const numRegex = /^\d+(\.\d+)?/;
const sepRegex = /^\s*[°'"]\s*|\s+/;

const parse = (str = '') => {
	str = str.trim();
	const neg = /^[SW-]/i.test(str);
	str = str.replace(/^[NSEW+-]\s*/i, '');

	let sum = 0;
	let unitIndex = 0;
	while (str !== '') {
		const strNum = str.match(numRegex)?.[0];
		if (strNum == null) {
			return NaN;
		}
		str = str.replace(numRegex, '');
		const strSep = str.match(sepRegex)?.[0];
		if (strSep != null) {
			str = str.replace(sepRegex, '');
			const sep = strSep.trim();
			if (sep !== '') {
				const index = units.indexOf(sep);
				if (index < unitIndex) {
					return NaN;
				}
				unitIndex = index;
			}
		}
		sum += Number(strNum) * (60 ** -unitIndex);
		unitIndex += 1;
	}

	return toRadian(neg? - sum: sum);
};

const stringify = (angle, pos = '', neg = '-', signAtTheEnd = false) => {
	const dec = Math.abs(angle / Math.PI * 180);
	const tSec = Math.round(dec * 3600);
	const sec = tSec % 60;
	const tMin = (tSec - sec) / 60;
	const min = tMin % 60;
	const tDeg = (tMin - min) / 60;
	const deg = tDeg;
	const sign = angle < 0 ? neg : pos;
	const middle = `${deg}°${(min + '').padStart(2, 0)}'${(sec + '').padStart(2, 0)}"`;
	return signAtTheEnd ? middle + sign : sign + middle;
};

const calcSigned = (adj, opp) => {
	const len = Math.sqrt(adj**2 + opp**2);
	if (len === 0) {
		return len;
	}
	if (opp >= 0) {
		return Math.acos(adj/len);
	}
	return - Math.acos(adj/len);
};

const calcUnsigned = (adj, opp) => {
	const len = Math.sqrt(adj**2 + opp**2);
	if (len === 0) {
		return len;
	}
	if (opp >= 0) {
		return Math.acos(adj/len);
	}
	return Math.PI*2 - Math.acos(adj/len);
};

const ANGLE = {
	parse,
	stringify,
	calcSigned,
	calcUnsigned,
};

export default ANGLE;
