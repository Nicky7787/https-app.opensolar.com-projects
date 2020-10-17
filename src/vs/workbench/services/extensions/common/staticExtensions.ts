/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionDescription, ExtensionIdentifier, IExtensionManifest } from 'vs/platform/extensions/common/extensions';
import { URI } from 'vs/base/common/uri';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IFileService } from 'vs/platform/files/common/files';
import { joinPath } from 'vs/base/common/resources';

export const IStaticExtensionsService = createDecorator<IStaticExtensionsService>('IStaticExtensionsService');

export interface IStaticExtensionsService {
	_serviceBrand: any;
	getExtensions(): Promise<IExtensionDescription[]>;
}

export class StaticExtensionsService implements IStaticExtensionsService {

	_serviceBrand: any;

	private readonly _descriptions: Promise<IExtensionDescription[]>;

	constructor(@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService, @IFileService fileService: IFileService) {

		this._descriptions = new Promise(async (s, e) => {
			const staticExtensions = environmentService.options && Array.isArray(environmentService.options.staticExtensions) ? environmentService.options.staticExtensions : [];
			const result: IExtensionDescription[] = [];
			for (const data of staticExtensions) {
				try {
					const extensionLocation = typeof data.extensionLocation === 'string' ? URI.parse(data.extensionLocation) : URI.revive(data.extensionLocation);

					let packageJSON = data.packageJSON;
					if (!packageJSON) {
						const packageJSONLoc = joinPath(extensionLocation, 'package.json');
						const content = await fileService.readFile(packageJSONLoc);
						packageJSON = <IExtensionManifest>JSON.parse(content.value.toString());
					}

					const packageJSONOverrides = data.packageJSONOverrides || {};

					result.push(<IExtensionDescription>{
						identifier: new ExtensionIdentifier(`${packageJSON.publisher}.${packageJSON.name}`),
						extensionLocation,
						...packageJSON,
						...packageJSONOverrides
					});
				} catch (e) {
					console.log('Error laoding static extension: ', e);
				}
			}
			s(result);
		});
	}

	async getExtensions(): Promise<IExtensionDescription[]> {
		return this._descriptions;
	}
}

registerSingleton(IStaticExtensionsService, StaticExtensionsService, true);
