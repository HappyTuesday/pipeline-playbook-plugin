package com.yit.deploy.plugin.steps.tasks;

import hudson.scm.SCM;
import org.jenkinsci.plugins.workflow.steps.scm.GenericSCMStep;

public class SCMTask extends AbstractJenkinsTask {

    private SCM scm;
    private boolean poll = true;
    private boolean changelog = true;

    public void setScm(SCM scm) {
        this.scm = scm;
    }

    public void setChangelog(boolean changelog) {
        this.changelog = changelog;
    }

    public void setPoll(boolean poll) {
        this.poll = poll;
    }

    /**
     * starts the step and blocking util the step to complete or throw exceptions if failed.
     */
    @Override
    public Object start() {
        GenericSCMStep step = new GenericSCMStep(scm);
        step.setPoll(poll);
        step.setChangelog(changelog);
        try {
            step.checkout(getRun(), getExecution().getPwd(), getTaskListener(), getLaunch());
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return null;
    }

    /**
     * gracefully stop this step if it is running from another thread.
     */
    @Override
    public void stop() {
    }
}
