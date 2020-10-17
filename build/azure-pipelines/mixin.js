/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const filter = require('gulp-filter');
const es = require('event-stream');
const vfs = require('vinyl-fs');
const fancyLog = require('fancy-log');
const ansiColors = require('ansi-colors');

function main() {
	const quality = process.env['VSCODE_QUALITY'];

	if (!quality) {
		console.log('Missing VSCODE_QUALITY, skipping mixin');
		return;
	}

	fancyLog(ansiColors.blue('[mixin]'), `Mixing in sources:`);
	return vfs
		.src(`quality/${quality}/**`, { base: `quality/${quality}` })
		.pipe(filter(f => !f.isDirectory()))
		.pipe(es.mapSync(function (f) {
			fancyLog(ansiColors.blue('[mixin]'), f.relative, ansiColors.green('✔︎'));
			return f;
		}))
		.pipe(vfs.dest('.'));
}

main();
