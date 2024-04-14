const ANGLE = {
	parse: (str) => {
		str = str.trim();
		let sign = 1;
		if (str.startsWith('-')) {
			str = str.substring(1).trim();
			sign = -1;
		}
		const values = str.trim().split(/\s+/).map((value, i) => {
			return value * (60 ** -i);
		});
		const sum = values.reduce((a, b) => a + b, 0);
		return sum * sign;
	},
};

export default ANGLE;
