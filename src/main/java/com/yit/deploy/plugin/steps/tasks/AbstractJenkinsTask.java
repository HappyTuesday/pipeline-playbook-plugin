package com.yit.deploy.plugin.steps.tasks;

import com.yit.deploy.plugin.steps.DeployExecution;
import hudson.FilePath;
import hudson.Launcher;
import hudson.model.Run;
import hudson.model.TaskListener;

public abstract class AbstractJenkinsTask implements JenkinsTask {
    private DeployExecution execution;

    public DeployExecution getExecution() {
        return execution;
    }

    public void setExecution(DeployExecution execution) {
        this.execution = execution;
    }

    <T> T getContextVariable(Class<T> clazz) {
        return execution.getContextVariable(clazz);
    }

    TaskListener getTaskListener() {
        return getExecution().getTaskListener();
    }

    Run getRun() {
        return getContextVariable(Run.class);
    }

    Launcher getLaunch() {
        return getContextVariable(Launcher.class);
    }
}
