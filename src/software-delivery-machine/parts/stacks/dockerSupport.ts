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

<<<<<<< HEAD
export interface DockerOptions {
    registry: string;
    user: string;
    password: string;
=======
import { SoftwareDeliveryMachine } from "../../../blueprint/SoftwareDeliveryMachine";
import { DockerBuildGoal } from "../../../common/delivery/goals/common/commonGoals";
import { executeDockerBuild } from "../../../common/delivery/docker/executeDockerBuild";

/**
 * Add Docker build capability
 * @param {SoftwareDeliveryMachine} softwareDeliveryMachine
 */
export function addDockerSupport(softwareDeliveryMachine: SoftwareDeliveryMachine) {
    softwareDeliveryMachine
        .addGoalImplementation("dockerBuild", DockerBuildGoal,
            executeDockerBuild(softwareDeliveryMachine.opts.projectLoader));

>>>>>>> Docker bits and pieces
}
