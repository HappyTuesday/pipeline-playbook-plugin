package com.yit.deploy.plugin.steps;

import com.yit.deploy.core.exceptions.TaskExecutionException;
import com.yit.deploy.core.function.Action;
import com.yit.deploy.core.function.Lambda;
import com.yit.deploy.core.model.DeployUser;
import com.yit.deploy.core.model.PipelineScriptSteps;
import com.yit.deploy.plugin.steps.tasks.*;
import groovy.lang.Closure;
import hudson.AbortException;
import hudson.FilePath;
import hudson.console.HyperlinkNote;
import hudson.model.*;
import hudson.plugins.git.GitSCM;
import hudson.plugins.git.Revision;
import hudson.plugins.git.util.BuildData;
import hudson.scm.SCM;
import hudson.slaves.WorkspaceList;
import hudson.tasks.Mailer;
import org.apache.commons.lang3.StringEscapeUtils;
import org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition;
import org.jenkinsci.plugins.workflow.flow.FlowDefinition;
import org.jenkinsci.plugins.workflow.job.WorkflowJob;

import javax.annotation.Nonnull;
import javax.annotation.Nullable;
import java.io.IOException;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

public class PipelineScriptStepsSupport implements PipelineScriptSteps, Serializable {

    private DeployExecution execution;

    public PipelineScriptStepsSupport(DeployExecution execution) {
        this.execution = execution;
    }

    @Override
    public String pwd(boolean tmp) {
        FilePath ws = execution.getPwd();
        if (tmp) {
            ws = ws.sibling(ws.getName() + System.getProperty(WorkspaceList.class.getName(), "@") + "tmp");
        }
        return ws.getRemote();
    }

    @Override
    public <T> T stage(String name, Closure<T> closure) {
        execution.printf("== stage [%s] ==\n", name);
        return closure.call();
    }

    @Override
    public void parallel(Map<String, Runnable> map) {
        ParallelTask t = execution.createTask(ParallelTask.class);
        t.setMap(map);
        execution.executeTask(t);
    }

    @Override
    public void echo(@Nonnull Object obj) {
        execution.println(obj.toString());
    }

    @Override
    public void error(@Nonnull Object obj) throws AbortException {
        throw new AbortException(obj.toString());
    }

    @Override
    public void checkout(SCM scm) {
        SCMTask t = execution.createTask(SCMTask.class);
        t.setScm(scm);
        execution.executeTask(t);
    }

    @Override
    public void dir(String path, Runnable runnable) {
        FilePath origin = execution.getPwd();
        execution.setPwd(execution.getPwd().child(path));
        try {
            runnable.run();
        } finally {
            execution.setPwd(origin);
        }
    }

    @Nonnull
    @Override
    public String input(@Nonnull String message, @Nonnull List<String> choices) throws AbortException {
        if (choices.isEmpty()) {
            choices = new ArrayList<>(choices);
            choices.add("Abort");
        }
        InputTask t = execution.createTask(InputTask.class);
        t.setMessage(message);
        t.setOptions(choices);
        String choice = (String) execution.executeTask(t);
        if ("abort".equals(choice.toLowerCase())) {
            User user = User.current();
            throw new AbortException("input is aborted" + (user == null ? "" : " " + user.getDisplayName()));
        }
        return choice;
    }

    @Override
    public void mail(@Nonnull Map<String, String> args) {
        MailTask t = execution.createTask(MailTask.class);
        t.setCharset(args.get("charset"));
        t.setSubject(args.get("subject"));
        t.setBody(args.get("body"));
        t.setFrom(args.get("from"));
        t.setTo(args.get("to"));
        t.setCc(args.get("cc"));
        t.setBcc(args.get("bcc"));
        t.setReplyTo(args.get("replyTo"));
        t.setMimeType(args.get("mimeType"));
        execution.executeTask(t);
    }

    @Override
    public void sleepInMilliseconds(long milliseconds) throws TaskExecutionException {
        SleepTask t = execution.createTask(SleepTask.class);
        t.setTime(milliseconds);
        execution.executeTask(t);
    }

    @Nonnull
    @Override
    public TaskListener getTaskListener() {
        return execution.getContextVariable(TaskListener.class);
    }

    @Override
    public void build(String job, List<ParameterValue> parameters, boolean wait, boolean propagate) {
        BuildTask t = execution.createTask(BuildTask.class);
        t.setJob(job);
        t.setParameters(parameters);
        t.setWait(wait);
        t.setPropagate(propagate);
        execution.executeTask(t);
    }

    @Nonnull
    @Override
    public Run getRun() {
        return execution.getContextVariable(Run.class);
    }

    @Nullable
    @Override
    public SCM getSCM() {
        Job job = getRun().getParent();
        if (job instanceof WorkflowJob) {
            FlowDefinition fdn = ((WorkflowJob) job).getDefinition();
            if (fdn instanceof CpsScmFlowDefinition) {
                return ((CpsScmFlowDefinition) fdn).getScm();
            }
        }
        return null;
    }

    @Override
    public String makeLink(String url, String text) {
        url = StringEscapeUtils.escapeHtml4(url).replaceAll("'","&apos;");
        return HyperlinkNote.encodeTo(url, text);
    }

    @Override
    public String getBranch(SCM scm) {
        return ((GitSCM) scm).getBranches().get(0).getName();
    }

    @Override
    public void setBranch(SCM scm, String branch) {
        ((GitSCM) scm).getBranches().get(0).setName(branch);
    }

    @Override
    @Nonnull
    public DeployUser getCurrentDeployUser() {
        Cause.UserIdCause cause = (Cause.UserIdCause) getRun().getCause(Cause.UserIdCause.class);
        return getDeployUser(cause == null ? null : cause.getUserId());
    }

    @Override
    public DeployUser getDeployUser(String userId) {
        DeployUser deployUser = new DeployUser();

        if (userId == null || userId.isEmpty()) {
            return deployUser;
        }

        User user = User.get(userId);
        deployUser.setId(user.getId());
        deployUser.setFullName(user.getFullName());
        deployUser.setDisplayName(user.getDisplayName());
        List<UserProperty> properties = user.getAllProperties();
        Mailer.UserProperty mailProperty = (Mailer.UserProperty) Lambda.find(properties, p -> p instanceof Mailer.UserProperty);

        if (mailProperty == null) {
            return deployUser;
        }

        deployUser.setEmailAddress(mailProperty.getAddress());

        return deployUser;
    }

    @Override
    public String getBuildCommitHash(Job job, Run run, String gitRepositoryUrl) {
        for (SCM scm : ((WorkflowJob) job).getSCMs()) {
            BuildData data = ((GitSCM) scm).getBuildData(run);
            if (data != null && data.getRemoteUrls().contains(gitRepositoryUrl)) {
                Revision revision = data.getLastBuiltRevision();
                return revision == null ? null : revision.getSha1String();
            }
        }
        return null;
    }
}