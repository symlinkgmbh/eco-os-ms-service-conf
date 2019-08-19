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
import { PkApi, MsConf, MsOverride } from "@symlinkde/eco-os-pk-models";
import { AbstractRoutes, injectValidatorService } from "@symlinkde/eco-os-pk-api";
import { Application, Response, NextFunction } from "express";
import { StaticEcoConfigFactory } from "../../infrastructure/EcoConfig/StaticEcoConfigFactory";
import { IEcoOsConfig } from "../../infrastructure/EcoConfig/IEcoOsConfig";

@injectValidatorService
export class ConfigRoute extends AbstractRoutes implements PkApi.IRoute {
  private config: IEcoOsConfig;
  private validatorService!: PkApi.IValidator;
  private postConfiPattern: PkApi.IValidatorPattern = {
    key: "",
    content: "",
  };

  constructor(app: Application) {
    super(app);
    this.config = StaticEcoConfigFactory.getConfigInstance();
    this.activate();
  }

  public activate(): void {
    this.getConfig();
    this.getAllConfig();
    this.postConfig();
    this.deleteConfig();
    this.deleteAllConfigEntries();
    this.updateConfigEntry();
  }

  private getConfig(): void {
    this.getApp()
      .route("/config/:index")
      .get((req: MsOverride.IRequest, res: Response, next: NextFunction) => {
        this.config
          .getConfigEntry(req.params.index)
          .then((entry) => {
            res.send(entry);
          })
          .catch((err) => {
            next(err);
          });
      });
  }

  private getAllConfig(): void {
    this.getApp()
      .route("/config")
      .get((req: MsOverride.IRequest, res: Response, next: NextFunction) => {
        this.config
          .getAllConfigEntries()
          .then((entries) => {
            res.send(entries);
          })
          .catch((err) => {
            next(err);
          });
      });
  }

  private postConfig(): void {
    this.getApp()
      .route("/config")
      .post((req: MsOverride.IRequest, res: Response, next: NextFunction) => {
        this.validatorService.validate(req.body, this.postConfiPattern);
        const { key, content } = req.body as MsConf.IConfigEntry;
        this.config
          .setConfigEntry(key, content)
          .then(() => {
            res.sendStatus(200);
          })
          .catch((err) => {
            next(err);
          });
      });
  }

  private deleteConfig(): void {
    this.getApp()
      .route("/config/:index")
      .delete((req: MsOverride.IRequest, res: Response, next: NextFunction) => {
        this.config
          .deleteConfigEntry(req.params.index)
          .then((entry) => {
            res.send(entry);
          })
          .catch((err) => {
            next(err);
          });
      });
  }

  private deleteAllConfigEntries(): void {
    this.getApp()
      .route("/config")
      .delete((req: MsOverride.IRequest, res: Response, next: NextFunction) => {
        this.config
          .deleteAllConfigEntries()
          .then(() => {
            res.sendStatus(200);
          })
          .catch((err) => {
            next(err);
          });
      });
  }

  private updateConfigEntry(): void {
    this.getApp()
      .route("/config")
      .put((req: MsOverride.IRequest, res: Response, next: NextFunction) => {
        this.validatorService.validate(req.body, this.postConfiPattern);
        const { key, content } = req.body as MsConf.IConfigEntry;
        this.config
          .updateConfigEntry(key, content)
          .then(() => {
            res.sendStatus(200);
          })
          .catch((err) => {
            next(err);
          });
      });
  }
}
