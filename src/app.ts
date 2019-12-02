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



import "reflect-metadata";
import Config from "config";
import { hostname } from "os";
import { serviceContainer, bootstrapperContainer, ECO_OS_PK_CORE_TYPES } from "@symlinkde/eco-os-pk-core";
import { PkCore } from "@symlinkde/eco-os-pk-models";
import { Log, LogLevel } from "@symlinkde/eco-os-pk-log";
import { Api } from "./api/Api";
import { Application } from "express";
import { redisContainer, REDIS_TYPES } from "@symlinkde/eco-os-pk-redis";
import { StaticEcoConfigFactory } from "./infrastructure/EcoConfig/StaticEcoConfigFactory";
import { StaticConfHelper } from "./infrastructure/Helper";

export class Bootstrapper {
  public static getInstance(): Bootstrapper {
    if (!Bootstrapper.instance) {
      Bootstrapper.instance = new Bootstrapper();
    }

    return Bootstrapper.instance;
  }

  private static instance: Bootstrapper;
  private bootstrapper: PkCore.IBootstrapper;
  private api: Api;

  private constructor() {
    if (!process.env.SECONDLOCK_REGISTRY_URI) {
      throw new Error("missing SECONDLOCK_REGISTRY_URI env variable");
    }

    bootstrapperContainer.bind("SECONDLOCK_REGISTRY_URI").toConstantValue(process.env.SECONDLOCK_REGISTRY_URI);
    bootstrapperContainer.bind<PkCore.IBootstrapperConfig>(ECO_OS_PK_CORE_TYPES.IBootstrapperConfig).toConstantValue(<
      PkCore.IBootstrapperConfig
    >{
      name: Config.get("name"),
      address: hostname(),
      url: `http://${hostname()}:${Config.get("server.port")}`,
      license: {
        id: Config.get("serviceId"),
      },
    });

    this.bootstrapper = bootstrapperContainer.get<PkCore.IBootstrapper>(ECO_OS_PK_CORE_TYPES.IBootstrapper);
    serviceContainer.rebind("SECONDLOCK_REGISTRY_URI").toConstantValue(process.env.SECONDLOCK_REGISTRY_URI);
    this.api = new Api();
    this.bootstrapper.unsignFromServiceRegistryOnProcessTerminate(process);
    this.bootstrapper.loadGobalErrorHandler(process);
  }

  public async init(): Promise<Application> {
    try {
      await this.checkForRequiredEnvironmentVariables();
      this.initLogSystem();
      await this.loadFactorySettings();
      await this.bindRedisConfig();
      await this.bootstrapper.signInServiceRegistry();
      return await this.api.init();
    } catch (err) {
      Log.log(err, LogLevel.error);
      process.exit(1);
      throw new Error(err);
    }
  }

  private initLogSystem(): void {
    Log.log(`init ${Config.get("name")} ${Config.get("version")}`, LogLevel.info);
    return;
  }

  private async checkForRequiredEnvironmentVariables(): Promise<void> {
    if (!process.env.SECONDLOCK_MONGO_USER_DATA) {
      Log.log("environment variable SECONDLOCK_MONGO_USER_DATA is missing", LogLevel.error);
      process.exit(1);
    }

    if (!process.env.SECONDLOCK_MONGO_CONTENT_DATA) {
      Log.log("environment variable SECONDLOCK_MONGO_CONTENT_DATA is missing", LogLevel.error);
      process.exit(1);
    }

    if (!process.env.SECONDLOCK_MONGO_KEY_DATA) {
      Log.log("environment variable SECONDLOCK_MONGO_KEY_DATA is missing", LogLevel.error);
      process.exit(1);
    }

    if (!process.env.SECONDLOCK_MONGO_CONF_DATA) {
      Log.log("environment variable SECONDLOCK_MONGO_CONF_DATA is missing", LogLevel.error);
      process.exit(1);
    }

    if (!process.env.SECONDLOCK_MONGO_IP_PROTECTION_DATA) {
      Log.log("environment variable SECONDLOCK_MONGO_IP_PROTECTION_DATA is missing", LogLevel.error);
      process.exit(1);
    }

    if (!process.env.SECONDLOCK_MONGO_FEDERATION_DATA) {
      Log.log("environment variable SECONDLOCK_MONGO_FEDERATION_DATA is missing", LogLevel.error);
      process.exit(1);
    }

    if (!process.env.SECONDLOCK_URL) {
      Log.log("environment variable SECONDLOCK_URL is missing", LogLevel.error);
      process.exit(1);
    }

    Log.log(`use ${process.env.SECONDLOCK_MONGO_USER_DATA} for user db collection`, LogLevel.info);
    Log.log(`use ${process.env.SECONDLOCK_MONGO_CONTENT_DATA} for content db collection`, LogLevel.info);
    Log.log(`use ${process.env.SECONDLOCK_MONGO_KEY_DATA} for key db collection`, LogLevel.info);
    Log.log(`use ${process.env.SECONDLOCK_MONGO_CONF_DATA} for configuration db collection`, LogLevel.info);
    Log.log(`use ${process.env.SECONDLOCK_MONGO_IP_PROTECTION_DATA} for ip protection db collection`, LogLevel.info);
    Log.log(`use ${process.env.SECONDLOCK_URL} for host URL`, LogLevel.info);
  }

  private async loadFactorySettings(): Promise<void> {
    const redisConfig = await this.bootstrapper.exposeRedisConfig();
    Log.log(`ready redis config from service registry. use ${redisConfig} for communication with redis`, LogLevel.info);

    Log.log("import redis config", LogLevel.info);
    const configStorage = StaticEcoConfigFactory.getConfigInstance();
    try {
      await configStorage.setConfigEntry("redis", redisConfig);
    } catch (err) {
      if (err.error && err.error.code === 816) {
        Log.log("entry alreay exists. skipp", LogLevel.info);
      } else {
        Log.log(err, LogLevel.error);
        process.exit(1);
      }
    }

    const factorySettings: object = Config.get("props");
    Object.keys(factorySettings).map(async (setting: any) => {
      Log.log(`check if entry for setting: ${setting} exists`, LogLevel.info);
      try {
        if (setting === "auth") {
          Log.log("change token secret", LogLevel.info);
          const conf: any = Config.get(`props.${setting}`);
          const confTemp: any = { ...conf };
          confTemp.secret = StaticConfHelper.getRandomSecert();
          await configStorage.setConfigEntry(setting, confTemp);
        } else {
          await configStorage.setConfigEntry(setting, Config.get(`props.${setting}`));
        }
      } catch (err) {
        if (err.error && err.error.code === 816) {
          Log.log("entry alreay exists. skipp", LogLevel.info);
        } else {
          Log.log(err, LogLevel.error);
          process.exit(1);
        }
      }
    });
  }

  private async bindRedisConfig(): Promise<void> {
    try {
      const redisConfig = await this.bootstrapper.exposeRedisConfig();
      redisContainer.bind(REDIS_TYPES.REDIS_HOST).toConstantValue(redisConfig.split(":")[0]);
      redisContainer.bind(REDIS_TYPES.REDIS_PORT).toConstantValue(redisConfig.split(":")[1]);
      return;
    } catch (err) {
      Log.log(err, LogLevel.error);
      process.exit(1);
    }
  }
}
