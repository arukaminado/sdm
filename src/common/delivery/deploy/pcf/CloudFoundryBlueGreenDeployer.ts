/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { logger } from "@atomist/automation-client";
import { ProjectOperationCredentials } from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import * as yaml from "js-yaml";

import * as _ from "lodash";

import { Project } from "@atomist/automation-client/project/Project";
import { DeployableArtifact } from "../../../../spi/artifact/ArtifactStore";
import { Deployer } from "../../../../spi/deploy/Deployer";
import { InterpretedLog } from "../../../../spi/log/InterpretedLog";
import { ProgressLog } from "../../../../spi/log/ProgressLog";
import { ProjectLoader } from "../../../repo/ProjectLoader";
import { CloudFoundryApi, initializeCloudFoundry } from "./CloudFoundryApi";
import {BlueGreenNamer, CloudFoundryBlueGreener} from "./CloudFoundryBlueGreener";
import {Manifest, ManifestApplication} from "./CloudFoundryManifest";
import { CloudFoundryPusher } from "./CloudFoundryPusher";
import { CloudFoundryDeployment, CloudFoundryInfo, CloudFoundryManifestPath } from "./CloudFoundryTarget";
import { ProjectArchiver } from "./ProjectArchiver";

/**
 * Use the Cloud Foundry API to orchestrae a blue green deployment.
 */
export class CloudFoundryBlueGreenDeployer implements Deployer<CloudFoundryInfo, CloudFoundryDeployment> {

    constructor(private readonly projectLoader: ProjectLoader) {
    }

    private async getManifest(p: Project): Promise<Manifest> {
        const manifestFile = await p.findFile(CloudFoundryManifestPath);
        const manifestContent = await manifestFile.getContent();
        return yaml.load(manifestContent);
    }

    public async deploy(da: DeployableArtifact,
                        cfi: CloudFoundryInfo,
                        log: ProgressLog,
                        credentials: ProjectOperationCredentials,
                        team: string): Promise<CloudFoundryDeployment[]> {
        logger.info("Deploying app [%j] to Cloud Foundry [%j]", da, {...cfi, password: "REDACTED"});
        if (!cfi.api || !cfi.username || !cfi.password || !cfi.space) {
            throw new Error("cloud foundry authentication information missing. See CloudFoundryTarget.ts");
        }
        return this.projectLoader.doWithProject({credentials, id: da.id, readOnly: !da.cwd}, async project => {
            const archiver = new ProjectArchiver(log);
            const packageFile = await archiver.archive(project, da);
            const manifest = await this.getManifest(project);
            const cfClient = await initializeCloudFoundry(cfi);
            const cfApi = new CloudFoundryApi(cfClient);
            const pusher = new CloudFoundryPusher(cfApi, cfi.space);
            const deployments: Array<Promise<CloudFoundryDeployment>> = manifest.applications.map(async manifestApp => {
                const namer = new BlueGreenNamer(manifestApp.name);
                const bger = new CloudFoundryBlueGreener(cfApi, pusher, namer, log);
                await bger.cleanUpExistingBlueGreenApps();
                const deployment = await bger.createNextAppWithRoutes(manifestApp, packageFile);
                await bger.retireCurrentApp();
                return deployment;
            });
            return Promise.all(deployments);
        });
    }

    public async findDeployments(da: DeployableArtifact,
                                 cfi: CloudFoundryInfo,
                                 credentials: ProjectOperationCredentials): Promise<CloudFoundryDeployment[]> {
        if (!cfi.api || !cfi.username || !cfi.password || !cfi.space) {
            throw new Error("cloud foundry authentication information missing. See CloudFoundryTarget.ts");
        }
        return this.projectLoader.doWithProject({credentials, id: da.id, readOnly: true}, async project => {
            const manifest = await this.getManifest(project);
            const cfClient = await initializeCloudFoundry(cfi);
            const cfApi = new CloudFoundryApi(cfClient);
            const pusher = new CloudFoundryPusher(cfApi, cfi.space);
            const spaceGuid = await pusher.getSpaceGuid();
            const appNames = manifest.applications.map( manifestApp => {
                const namer = new BlueGreenNamer(manifestApp.name);
                return [namer.getCurrentAppName(), namer.getPreviousAppName(), namer.getNextAppName()];
            });
            const existingAppNames = _.flatten(appNames).map(async n => {
                const app = await cfApi.getApp(spaceGuid, n);
                return !!app ? n : undefined;
            });
            const onlyExistingAppNames: string[] = _.compact(await Promise.all(existingAppNames));
            return onlyExistingAppNames.map(appName => {
                return {
                    appName,
                } as CloudFoundryDeployment;
            });
        });
    }

    public async undeploy(cfi: CloudFoundryInfo,
                          deployment: CloudFoundryDeployment,
                          log: ProgressLog): Promise<any> {
        logger.info(`Undeploying app ${cfi.space}:${deployment.appName} from Cloud Foundry ${cfi.description}`);
        if (!cfi.api || !cfi.org || !cfi.username || !cfi.password || !cfi.space) {
            throw new Error("cloud foundry authentication information missing. See CloudFoundryTarget.ts");
        }
        const cfClient = await initializeCloudFoundry(cfi);
        const cfApi = new CloudFoundryApi(cfClient);
        const space = await cfApi.getSpaceByName(cfi.space);
        const spaceGuid = space.metadata.guid;
        const app = await cfApi.getApp(spaceGuid, deployment.appName);
        if (app) {
            return cfApi.deleteApp(app.metadata.guid);
        }
    }

   public logInterpreter(log: string): InterpretedLog {
        return {
            relevantPart: log.split("\n").slice(-10).join("\n"),
            message: "Oh no!",
            includeFullLog: true,
        };
   }
}
