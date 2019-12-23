package com.yit.deploy.plugin.steps;

import com.google.common.collect.ImmutableSet;
import hudson.Extension;
import hudson.FilePath;
import hudson.Launcher;
import hudson.model.Run;
import hudson.model.TaskListener;
import org.jenkinsci.plugins.workflow.steps.Step;
import org.jenkinsci.plugins.workflow.steps.StepContext;
import org.jenkinsci.plugins.workflow.steps.StepDescriptor;
import org.jenkinsci.plugins.workflow.steps.StepExecution;
import org.kohsuke.stapler.DataBoundConstructor;
import org.kohsuke.stapler.DataBoundSetter;

import javax.annotation.Nonnull;
import java.util.Set;

/**
 * Created by nick on 29/12/2017.
 */
public class ConfigureDeployStep extends Step {

    @DataBoundSetter
    private String projectRepositoryUrl;

    @DataBoundSetter
    private String projectBranch;

    @DataBoundSetter
    private String localPath;

    @DataBoundConstructor
    public ConfigureDeployStep() {
    }

    /**
     * Start execution of something and report the end result back to the given callback.
     *
     * Arguments are passed when {@linkplain StepDescriptor#newInstance instantiating steps}.
     *
     * @return
     * true if the execution of this step has synchronously completed before this method returns.
     *      It is the callee's responsibility to set the return value via {@link StepContext#onSuccess(Object)}
     *      or {@link StepContext#onFailure(Throwable)}.
     *
     *      false if the asynchronous execution has started and that {@link StepContext}
     *      will be notified when the result comes in. (Note that the nature of asynchrony is such that it is possible
     *      for the {@link StepContext} to be already notified before this method returns.)
     * @throws Exception
     *      if any exception is thrown, {@link Step} is assumed to have completed abnormally synchronously
     *      (as if {@link StepContext#onFailure} is called and the method returned true.)
     */
    @Override
    public StepExecution start(StepContext context) throws Exception {
        return new ConfigureDeployExecution(projectRepositoryUrl, projectBranch, localPath, context);
    }

    static class ConfigureDeployExecution extends DeployExecution {
        private String projectRepositoryUrl;
        private String projectBranch;
        private String localPath;

        public ConfigureDeployExecution(String projectRepositoryUrl, String projectBranch, String localPath, StepContext context) {
            super(context);
            this.projectRepositoryUrl = projectRepositoryUrl;
            this.projectBranch = projectBranch;
            this.localPath = localPath;
        }

        /**
         * actual run logic
         *
         * @throws Exception
         */
        @Override
        protected Object run() throws Exception {
            DeployGlobalConfiguration c = DeployGlobalConfiguration.get();
            if (projectRepositoryUrl != null) {
                c.setProjectRepositoryUrl(projectRepositoryUrl);
            }
            if (projectBranch != null) {
                c.setProjectBranch(projectBranch);
            }
            if (localPath != null) {
                c.setLocalPath(localPath);
            }
            c.save();
            return null;
        }
    }

    @Extension
    public static class DescriptorImpl extends StepDescriptor {

        /**
         * Enumerates any kinds of context the {@link StepExecution} will treat as mandatory.
         * When {@link StepContext#get} is called, the return value may be null in general;
         * if your step cannot trivially handle a null value of a given kind, list that type here.
         * The Pipeline execution engine will then signal a user error before even starting your step if called in an inappropriate context.
         * For example, a step requesting a {@link Launcher} may only be run inside a {@code node{…}} block.
         * @return typically an {@link ImmutableSet#of(Object)} with context types like {@link TaskListener} or {@link Run} or {@link FilePath}
         */
        @Override
        public Set<? extends Class<?>> getRequiredContext() {
            return ImmutableSet.of(Run.class, FilePath.class);
        }

        /**
         * Return a short string that is a valid identifier for programming languages.
         * Follow the pattern {@code [a-z][A-Za-z0-9_]*}.
         * Step will be referenced by this name when used in a programming language.
         */
        @Override
        public String getFunctionName() {
            return "configureDeploy";
        }

        /**
         * Return a short string that is a valid identifier for programming languages.
         * Follow the pattern {@code [a-z][A-Za-z0-9_]*}.
         * Step will be referenced by this name when used in a programming language.
         */
        @Nonnull
        @Override
        public String getDisplayName() {
            return "Configure Deploy";
        }
    }
}
