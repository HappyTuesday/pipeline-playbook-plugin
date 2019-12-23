package com.yit.deploy.plugin.steps;

import com.google.common.collect.ImmutableSet;
import com.yit.deploy.core.model.Build;
import com.yit.deploy.core.model.DeploySpec;
import com.yit.deploy.core.model.PipelineScript;
import hudson.Extension;
import hudson.FilePath;
import hudson.Launcher;
import hudson.model.Run;
import hudson.model.TaskListener;
import org.codehaus.groovy.runtime.StringGroovyMethods;
import org.jenkinsci.plugins.workflow.steps.Step;
import org.jenkinsci.plugins.workflow.steps.StepContext;
import org.jenkinsci.plugins.workflow.steps.StepDescriptor;
import org.jenkinsci.plugins.workflow.steps.StepExecution;
import org.kohsuke.stapler.DataBoundConstructor;

import javax.annotation.Nonnull;
import java.util.*;

/**
 * Created by nick on 29/12/2017.
 */
public class DeployProjectStep extends Step {

    private Map<String, Object> params;

    @DataBoundConstructor
    public DeployProjectStep(Map<String, Object> params) {
        this.params = params;
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
    public StepExecution start(StepContext context) {
        return new DeployProjectExecution(params, context);
    }

    static class DeployProjectExecution extends DeployExecution {
        private static final long serialVersionUID = 1L;

        private Map<String, Object> params;

        public DeployProjectExecution(@Nonnull Map<String, Object> params, @Nonnull StepContext context) {
            super(context);
            this.params = params;
        }

        /**
         * actual run logic
         *
         */
        @Override
        protected Object run() {
            PipelineScript script = createPipelineScript();
            Map<String, Object> ps = new HashMap<>(params);
            DeploySpec spec = new DeploySpec(
                parseToList(ps.remove("tags")),
                parseToList(ps.remove("skip_tags")),
                parseToList(ps.remove("servers")),
                Collections.emptyList(),
                ps
            );
            Build build = new Build(getJobName(), spec, getDeployService(), script, null);
            build.execute();
            return null;
        }

        private static List<String> parseToList(Object value) {
            return value == null ? Collections.emptyList() : StringGroovyMethods.tokenize((CharSequence)value, ',');
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
            return "deployProject";
        }

        /**
         * Return a short string that is a valid identifier for programming languages.
         * Follow the pattern {@code [a-z][A-Za-z0-9_]*}.
         * Step will be referenced by this name when used in a programming language.
         */
        @Nonnull
        @Override
        public String getDisplayName() {
            return "Deploy Project";
        }
    }
}
