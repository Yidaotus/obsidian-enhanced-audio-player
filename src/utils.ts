export function secondsToString(num: number) {
	num = Math.floor(num);
	const h = String(Math.floor(num / 3600)).padStart(2, "0");
	const m = String(Math.floor(num / 60)).padStart(2, "0");
	const s = String(Math.floor((num % 3600) % 60)).padStart(2, "0");

	return `${h}:${m}:${s}`;
}

export function secondsToNumber(stmp: string): number {
	const nums = stmp.split(":").map((x) => Number.parseInt(x));
	return nums[2] + nums[1] * 60 + nums[0] * 3600;
}

/**
 * Returns a hash code from a string
 * @param  {String} str The string to hash.
 * @return {Number}    A 32bit integer
 * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
 */
export function hashCode(str: string) {
	let hash = 0;
	for (let i = 0, len = str.length; i < len; i++) {
		let chr = str.charCodeAt(i);
		hash = (hash << 5) - hash + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
}
