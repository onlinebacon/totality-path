const ANGLE = {
	parse: (str) => {
		const values = str.trim().split(/\s+/).map((value, i) => {
			return value * (60 ** -i);
		});
		const sum = values.reduce((a, b) => a + b, 0);
		return sum;
	},
};

export default ANGLE;
