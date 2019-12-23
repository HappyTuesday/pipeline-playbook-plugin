package com.yit.deploy.plugin.steps.tasks;

import hudson.AbortException;
import hudson.console.ModelHyperlinkNote;
import hudson.model.*;
import hudson.model.queue.QueueTaskFuture;
import jenkins.model.Jenkins;
import jenkins.model.ParameterizedJobMixIn;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;

public class BuildTask extends AbstractJenkinsTask {

    private static final long serialVersionUID = -1;

    private String job;
    private List<ParameterValue> parameters;
    private boolean wait;
    private boolean propagate;

    private transient volatile QueueTaskFuture<?> taskFuture;

    public void setJob(String job) {
        this.job = job;
    }

    public void setParameters(List<ParameterValue> parameters) {
        this.parameters = parameters;
    }

    public void setWait(boolean wait) {
        this.wait = wait;
    }

    public void setPropagate(boolean propagate) {
        this.propagate = propagate;
    }

    /**
     * starts the step and blocking util the step to complete or throw exceptions if failed.
     */
    @Override
    public Object start() throws AbortException, InterruptedException, ExecutionException {
        Run invokingRun = getContextVariable(Run.class);
        final ParameterizedJobMixIn.ParameterizedJob project = Jenkins.get().getItem(job, invokingRun.getParent(), ParameterizedJobMixIn.ParameterizedJob.class);
        if (project == null) {
            throw new AbortException("No parameterized job named " + job + " found");
        }
        getExecution().println("Scheduling project: " + ModelHyperlinkNote.encodeTo(project));

        List<Action> actions = new ArrayList<>();
        actions.add(new CauseAction(new Cause.UpstreamCause(invokingRun)));
        if (parameters != null) {
            actions.add(new ParametersAction(parameters));
        }
        int quietPeriod = project.getQuietPeriod();
        taskFuture = new ParameterizedJobMixIn() {
            @Override protected Job asJob() {
                return (Job) project;
            }
        }.scheduleBuild2(quietPeriod, actions.toArray(new Action[0]));
        if (taskFuture == null) {
            throw new AbortException("Failed to trigger build of " + ModelHyperlinkNote.encodeTo(project));
        }

        if (wait) {
            Run run = (Run) taskFuture.waitForStart();
            String runUrl = ModelHyperlinkNote.encodeTo("/" + run.getUrl(), run.toString());
            getExecution().println("Starting building: " + runUrl);
            try {
                taskFuture.get();
                if (propagate) {
                    Result result = run.getResult();
                    if (result == null) {
                        throw new IllegalStateException("Could not fetch the result of " + runUrl);
                    }
                    if (result.isWorseThan(Result.SUCCESS)) {
                        throw new AbortException("Failed to execute build of " + runUrl);
                    } else {
                        getExecution().println(runUrl + " finished.");
                    }
                }
            } catch (Exception e) {
                taskFuture = null;
                if (propagate) {
                    throw e;
                }
            }
        }
        taskFuture = null;
        return null;
    }

    /**
     * gracefully stop this step if it is running from another thread.
     */
    @Override
    public void stop() {
        Future future = this.taskFuture;
        if (future != null) {
            future.cancel(true);
        }
    }
}
