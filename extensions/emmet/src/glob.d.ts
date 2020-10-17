declare module 'glob' {
	function glob(pattern: string, options: any, cb: (err: Error | null, matches: string[]) => void): void;
	export default glob;
}

