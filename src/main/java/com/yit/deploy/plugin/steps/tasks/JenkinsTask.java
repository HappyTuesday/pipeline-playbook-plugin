package com.yit.deploy.plugin.steps.tasks;

import java.io.Serializable;

/**
 * A general step used in DeployProjectStep
 */
public interface JenkinsTask extends Serializable {
    /**
     * starts the step and blocking util the step to complete or throw exceptions if failed.
     */
    Object start() throws Exception;

    /**
     * gracefully stop this step if it is running from another thread.
     */
    void stop() throws Exception;
}
