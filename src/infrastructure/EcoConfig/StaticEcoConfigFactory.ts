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




import { IEcoOsConfig } from "./IEcoOsConfig";
import { configContainer } from "./EcoOsConfigContainer";
import { EcoOsConfig } from "./EcoOsConfig";
import { IEcoConfigCollector } from "./IEcoConfigCollector";
import { EcoConfigCollector } from "./EcoConfigCollector";

export class StaticEcoConfigFactory {
  public static getConfigInstance(): IEcoOsConfig {
    return configContainer.get<IEcoOsConfig>(EcoOsConfig);
  }

  public static getConfigCollectorInstance(): IEcoConfigCollector {
    return configContainer.get<IEcoConfigCollector>(EcoConfigCollector);
  }
}
