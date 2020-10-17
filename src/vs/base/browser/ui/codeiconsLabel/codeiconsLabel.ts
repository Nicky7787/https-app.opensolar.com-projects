/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./codicon/codicon';
import 'vs/css!./codicon/codicon-animations';
import { escape } from 'vs/base/common/strings';

function expand(text: string): string {
	return text.replace(/\$\(((.+?)(~(.*?))?)\)/g, (_match, _g1, name, _g3, animation) => {
		return `<span class="codicon icon-${name} ${animation ? `codeicons-animation-${animation}` : ''}"></span>`;
	});
}

export function renderCodicon(label: string): string {
	return expand(escape(label));
}

export class CodeiconsLabel {

	constructor(
		private readonly _container: HTMLElement
	) { }

	set text(text: string) {
		this._container.innerHTML = renderCodicon(text || '');
	}

	set title(title: string) {
		this._container.title = title;
	}
}
