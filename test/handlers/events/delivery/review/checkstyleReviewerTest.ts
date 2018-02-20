import "mocha";

import * as assert from "power-assert";
import { checkstyleReviewer } from "../../../../../src/handlers/events/delivery/review/checkstyleReviewer";
import { NodeFsLocalProject } from "@atomist/automation-client/project/local/NodeFsLocalProject";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";

const checkstylePath = "/Users/rodjohnson/tools/checkstyle-8.8";

describe("checkstyleReviewer", () => {

    it.skip("should work", async () => {
        const dir = "/Users/rodjohnson/temp/spring-rest-seed";
        const id = new GitHubRepoRef("atomist-seeds", "spring-rest-seed");
        const p = new NodeFsLocalProject(id, dir);
        const review = await checkstyleReviewer(checkstylePath)(p, null);
        assert(!!review);
        assert(review.comments.length === 10);
        console.log(JSON.stringify(review));
    });

});
