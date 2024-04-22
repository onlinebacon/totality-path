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

const ANGLE = { parse };

export default ANGLE;
