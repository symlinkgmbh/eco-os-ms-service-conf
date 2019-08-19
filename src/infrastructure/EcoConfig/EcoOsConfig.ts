/** 
* Copyright 2018-2019 Symlink GmbH 
* 
* Licensed under the Apache License, Version 2.0 (the "License"); 
* you may not use this file except in compliance with the License. 
* You may obtain a copy of the License at 
*  
*     http://www.apache.org/licenses/LICENSE-2.0 
* 
* Unless required by applicable law or agreed to in writing, software 
* distributed under the License is distributed on an "AS IS" BASIS, 
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
* See the License for the specific language governing permissions and 
* limitations under the License. 
* 
*/ 

import Config from "config";
import { MsConf, PkStorageConfig } from "@symlinkde/eco-os-pk-models";
import { IEcoOsConfig } from "./IEcoOsConfig";
import { injectable } from "inversify";
import { CustomRestError, apiResponseCodes } from "@symlinkde/eco-os-pk-api";
import { configContainer, CONFIG_TYPES } from "@symlinkde/eco-os-pk-storage-config";
import { Log, LogLevel } from "@symlinkde/eco-os-pk-log";

@injectable()
export class EcoOsConfig implements IEcoOsConfig {
  private configService: PkStorageConfig.IConfigService = configContainer.get<PkStorageConfig.IConfigService>(
    CONFIG_TYPES.IConfigService,
  );

  public async getConfigEntry(key: string): Promise<MsConf.IConfigEntry> {
    const mongoResult = await this.configService.get(key);

    if (mongoResult !== undefined && mongoResult !== null) {
      return <MsConf.IConfigEntry>{
        [key]: mongoResult.content,
      };
    }

    if (Config.has(`props.${key}`)) {
      Log.log(`process config request for "${key}" from factory settings`, LogLevel.info);
      return <MsConf.IConfigEntry>{
        [key]: Config.get(`props.${key}`),
      };
    }

    if (process.env[key] !== undefined) {
      Log.log(`process config request for "${key}" from environment variable`, LogLevel.info);
      return <MsConf.IConfigEntry>{
        [key]: process.env[key],
      };
    }

    return <MsConf.IConfigEntry>{
      [key]: "",
    };
  }

  public async setConfigEntry(key: string, content: string | number | Date | object): Promise<boolean> {
    const mongoResult = await this.configService.get(key);

    if (mongoResult !== undefined && mongoResult !== null) {
      throw new CustomRestError(
        {
          code: apiResponseCodes.C816.code,
          message: apiResponseCodes.C816.message,
        },
        400,
      );
    }
    await this.configService.create({
      key,
      content,
    });

    return true;
  }

  public async updateConfigEntry(key: string, content: string | number | Date | object): Promise<boolean> {
    return await this.configService.update(key, content);
  }
  public async deleteConfigEntry(key: string): Promise<boolean> {
    return await this.configService.delete(key);
  }

  public async deleteAllConfigEntries(): Promise<boolean> {
    return await this.configService.deleteAll();
  }

  public async getAllConfigEntries(): Promise<Array<MsConf.IConfig>> {
    const result = await this.configService.getAll();
    if (result !== undefined && result !== null) {
      return result;
    }

    return [];
  }
}
