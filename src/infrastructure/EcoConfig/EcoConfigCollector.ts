/**
 * Copyright 2018-2020 Symlink GmbH
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




import { IEcoConfigCollector } from "./IEcoConfigCollector";
import { Log, LogLevel } from "@symlinkde/eco-os-pk-log";
import { CustomRestError } from "@symlinkde/eco-os-pk-api";
import Axios, { AxiosResponse } from "axios";
import { MsConf, PkRedis, PkCore } from "@symlinkde/eco-os-pk-models";
import { injectable } from "inversify";
import { injectRedisClient } from "@symlinkde/eco-os-pk-redis";
import { injectRegistryClient } from "@symlinkde/eco-os-pk-core";
import { isArray } from "util";

@injectRegistryClient
@injectRedisClient
@injectable()
export class EcoConfigCollector implements IEcoConfigCollector {
  private redisClient!: PkRedis.IRedisClient;
  private registryClient!: PkCore.IEcoRegistryClient;

  public async collectServicesConfig(): Promise<Array<MsConf.IFeatureObject>> {
    try {
      return await this.loadRunningConfig();
    } catch (err) {
      Log.log(err, LogLevel.error);
      throw new CustomRestError(
        {
          code: 500,
          message: "can't load services config",
        },
        500,
      );
    }
  }

  public async collectServiceConfigFull(name: string): Promise<AxiosResponse> {
    try {
      const service = await this.registryClient.getRegistryEntriesByName(name);
      const result = await Axios.get(`${service.url}/internal`);
      return result.data;
    } catch (err) {
      Log.log(err, LogLevel.error);
      throw new CustomRestError(
        {
          code: 400,
          message: "problem in load config from service",
        },
        400,
      );
    }
  }

  private async loadRunningConfig(): Promise<any> {
    const result = await this.redisClient.get<Array<MsConf.IFeatureObject>>("cache.service.config");

    if (result === null) {
      const services: Array<{ name: string; url: string }> = await this.getServiceList();
      const serviceFeatures: Array<MsConf.IFeatureObject> = [];

      for (const index in services) {
        if (index) {
          const response = await Axios.get(`${services[index].url}/internal`);
          if (isArray(response.data.config.features)) {
            response.data.config.features.map((feature: MsConf.IFeatureObject) => {
              serviceFeatures.push(feature);
            });
          }
        }
      }

      await this.redisClient.set("cache.services.config", serviceFeatures, 600);
    }

    return await this.redisClient.get<Array<MsConf.IFeatureObject>>("cache.services.config");
  }

  private async getServiceList(): Promise<Array<{ name: string; url: string }>> {
    const registryServices = await this.registryClient.getAllRegistryEntries();

    const services: Array<{ name: string; url: string }> = [];
    registryServices.map((service) => {
      services.push(<{ name: string; url: string }>{
        name: service.name,
        url: service.url,
      });
    });

    return services;
  }
}
