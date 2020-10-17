/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import pkg from 'vs/platform/product/node/package';
import { Action } from 'vs/base/common/actions';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { URI } from 'vs/base/common/uri';
import { IExtensionHostProfile } from 'vs/workbench/services/extensions/common/extensions';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { localize } from 'vs/nls';
import { IRequestService } from 'vs/platform/request/node/request';
import { CancellationToken } from 'vs/base/common/cancellation';
import { asText } from 'vs/base/node/request';
import { join } from 'vs/base/common/path';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import Severity from 'vs/base/common/severity';

abstract class RepoInfo {
	readonly base: string;
	readonly owner: string;
	readonly repo: string;

	static fromExtension(desc: IExtensionDescription): RepoInfo | undefined {

		let result: RepoInfo | undefined;

		// scheme:auth/OWNER/REPO/issues/
		if (desc.bugs && typeof desc.bugs.url === 'string') {
			const base = URI.parse(desc.bugs.url);
			const match = /\/([^/]+)\/([^/]+)\/issues\/?$/.exec(desc.bugs.url);
			if (match) {
				result = {
					base: base.with({ path: null, fragment: null, query: null }).toString(true),
					owner: match[1],
					repo: match[2]
				};
			}
		}
		// scheme:auth/OWNER/REPO.git
		if (!result && desc.repository && typeof desc.repository.url === 'string') {
			const base = URI.parse(desc.repository.url);
			const match = /\/([^/]+)\/([^/]+)(\.git)?$/.exec(desc.repository.url);
			if (match) {
				result = {
					base: base.with({ path: null, fragment: null, query: null }).toString(true),
					owner: match[1],
					repo: match[2]
				};
			}
		}

		// for now only GH is supported
		if (result && result.base.indexOf('github') === -1) {
			result = undefined;
		}

		return result;
	}
}

export class SlowExtensionAction extends Action {

	constructor(
		readonly extension: IExtensionDescription,
		readonly profile: IExtensionHostProfile,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
	) {
		super('report.slow', localize('cmd.reportOrShow', "Performance Issue"), 'extension-action report-issue');
		this.enabled = Boolean(RepoInfo.fromExtension(extension));
	}

	async run(): Promise<void> {
		const action = await this._instantiationService.invokeFunction(createSlowExtensionAction, this.extension, this.profile);
		if (action) {
			await action.run();
		}
	}
}

export async function createSlowExtensionAction(
	accessor: ServicesAccessor,
	extension: IExtensionDescription,
	profile: IExtensionHostProfile
): Promise<Action | undefined> {

	const info = RepoInfo.fromExtension(extension);
	if (!info) {
		return undefined;
	}

	const requestService = accessor.get(IRequestService);
	const instaService = accessor.get(IInstantiationService);
	const url = `https://api.github.com/search/issues?q=is:issue+state:open+in:title+repo:${info.owner}/${info.repo}+%22Extension+causes+high+cpu+load%22`;
	const res = await requestService.request({ url }, CancellationToken.None);
	const rawText = await asText(res);
	if (!rawText) {
		return undefined;
	}

	const data = <{ total_count: number; }>JSON.parse(rawText);
	if (!data || typeof data.total_count !== 'number') {
		return undefined;
	} else if (data.total_count === 0) {
		return instaService.createInstance(ReportExtensionSlowAction, extension, info, profile);
	} else {
		return instaService.createInstance(ShowExtensionSlowAction, extension, info, profile);
	}
}

class ReportExtensionSlowAction extends Action {

	constructor(
		readonly extension: IExtensionDescription,
		readonly repoInfo: RepoInfo,
		readonly profile: IExtensionHostProfile,
		@IDialogService private readonly _dialogService: IDialogService,
	) {
		super('report.slow', localize('cmd.report', "Report Issue"));
	}

	async run(): Promise<void> {

		// rewrite pii (paths) and store on disk
		const profiler = await import('v8-inspect-profiler');
		const data = profiler.rewriteAbsolutePaths({ profile: <any>this.profile.data }, 'pii_removed');
		const path = join(os.homedir(), `${this.extension.identifier.value}-unresponsive.cpuprofile.txt`);
		await profiler.writeProfile(data, path).then(undefined, onUnexpectedError);

		// build issue
		const title = encodeURIComponent('Extension causes high cpu load');
		const osVersion = `${os.type()} ${os.arch()} ${os.release()}`;
		const message = `:warning: Make sure to **attach** this file from your *home*-directory:\n:warning:\`${path}\`\n\nFind more details here: https://github.com/Microsoft/vscode/wiki/Explain:-extension-causes-high-cpu-load`;
		const body = encodeURIComponent(`- Issue Type: \`Performance\`
- Extension Name: \`${this.extension.name}\`
- Extension Version: \`${this.extension.version}\`
- OS Version: \`${osVersion}\`
- VSCode version: \`${pkg.version}\`\n\n${message}`);

		const url = `${this.repoInfo.base}/${this.repoInfo.owner}/${this.repoInfo.repo}/issues/new/?body=${body}&title=${title}`;
		window.open(url);

		this._dialogService.show(
			Severity.Info,
			localize('attach.title', "Did you attach the CPU-Profile?"),
			[localize('ok', 'OK')],
			{ detail: localize('attach.msg', "This is a reminder to make sure that you have not forgotten to attach '{0}' to the issue you have just created.", path) }
		);
	}
}

class ShowExtensionSlowAction extends Action {

	constructor(
		readonly extension: IExtensionDescription,
		readonly repoInfo: RepoInfo,
		readonly profile: IExtensionHostProfile,
		@IDialogService private readonly _dialogService: IDialogService,
	) {
		super('show.slow', localize('cmd.show', "Show Issues"));
	}

	async run(): Promise<void> {

		// rewrite pii (paths) and store on disk
		const profiler = await import('v8-inspect-profiler');
		const data = profiler.rewriteAbsolutePaths({ profile: <any>this.profile.data }, 'pii_removed');
		const path = join(os.homedir(), `${this.extension.identifier.value}-unresponsive.cpuprofile.txt`);
		await profiler.writeProfile(data, path).then(undefined, onUnexpectedError);

		// show issues
		const url = `${this.repoInfo.base}/${this.repoInfo.owner}/${this.repoInfo.repo}/issues?utf8=✓&q=is%3Aissue+state%3Aopen+%22Extension+causes+high+cpu+load%22`;
		window.open(url);

		this._dialogService.show(
			Severity.Info,
			localize('attach.title', "Did you attach the CPU-Profile?"),
			[localize('ok', 'OK')],
			{ detail: localize('attach.msg2', "This is a reminder to make sure that you have not forgotten to attach '{0}' to an existing performance issue.", path) }
		);
	}
}
