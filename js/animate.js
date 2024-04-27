export const animate = (duration, it) => {
	const start = Date.now();
	const step = () => {
		const elapsed = Date.now() - start;
		const t = Math.min(1, elapsed/duration);
		it(t);
		if (t < 1) {
			requestAnimationFrame(step);
		}
	};
	step();
};
