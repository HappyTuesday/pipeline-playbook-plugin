package com.yit.deploy.plugin.steps;

import com.google.common.base.Function;
import com.google.common.base.Predicate;
import com.google.common.base.Predicates;
import com.google.common.collect.Collections2;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.common.collect.Sets;
import com.thoughtworks.xstream.InitializationException;
import com.yit.deploy.core.compile.DeployCompiler;
import com.yit.deploy.core.config.DeployConfig;
import com.yit.deploy.core.model.DeployModelTable;
import groovy.lang.Binding;
import groovy.lang.GroovyShell;
import hudson.*;
import hudson.model.*;
import hudson.model.Item;
import hudson.model.Job;
import hudson.model.View;
import javaposse.jobdsl.dsl.*;
import javaposse.jobdsl.plugin.*;
import javaposse.jobdsl.plugin.actions.*;
import jenkins.model.Jenkins;
import org.acegisecurity.AccessDeniedException;
import org.apache.commons.io.FilenameUtils;
import org.codehaus.groovy.control.CompilerConfiguration;
import org.codehaus.groovy.control.customizers.ImportCustomizer;
import org.jenkinsci.plugins.workflow.steps.Step;
import org.jenkinsci.plugins.workflow.steps.StepContext;
import org.jenkinsci.plugins.workflow.steps.StepDescriptor;
import org.jenkinsci.plugins.workflow.steps.StepExecution;
import org.kohsuke.stapler.DataBoundConstructor;

import javax.annotation.Nonnull;
import java.io.*;
import java.lang.reflect.InvocationTargetException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

import static java.lang.String.format;
import static javaposse.jobdsl.plugin.actions.GeneratedObjectsAction.extractGeneratedObjects;

public class GenerateJobsStep extends Step {

    private static final Logger LOG = Logger.getLogger(GenerateJobsStep.class.getName());

    private Map<String, Object> params;

    @DataBoundConstructor
    public GenerateJobsStep(Map<String, Object> params) {
        this.params = params;
    }

    /**
     * Start execution of something and report the end result back to the given callback.
     * <p>
     * Arguments are passed when {@linkplain StepDescriptor#newInstance instantiating steps}.
     *
     * @param context
     * @return true if the execution of this step has synchronously completed before this method returns.
     * It is the callee's responsibility to set the return value via {@link StepContext#onSuccess(Object)}
     * or {@link StepContext#onFailure(Throwable)}.
     * <p>
     * false if the asynchronous execution has started and that {@link StepContext}
     * will be notified when the result comes in. (Note that the nature of asynchrony is such that it is possible
     * for the {@link StepContext} to be already notified before this method returns.)
     * @throws Exception if any exception is thrown, {@link Step} is assumed to have completed abnormally synchronously
     *                   (as if {@link StepContext#onFailure} is called and the method returned true.)
     */
    @Override
    public StepExecution start(StepContext context) throws Exception {
        return new GenerateJobExecution(context);
    }

    static class GenerateJobExecution extends DeployExecution {
        public GenerateJobExecution(@Nonnull StepContext context) {
            super(context);
        }

        /**
         * actual run logic
         *
         * @throws Exception
         */
        @Override
        protected Object run() throws Exception {
            DeployConfig deployConfig = getDeployConfig();
            String jobDsl = deployConfig.getSourceFolder().childFile("jobs.groovy").getText();
            ExecuteDslScripts dslScripts = new ExecuteDslScripts(jobDsl);

            List<String> envs = DeployGlobalConfiguration.get().getEnvList();
            if (envs.isEmpty()) {
                printError("No envs defined in configuration! Please configure it properly.");
                return null;
            }

            println("Loading Job info from config project & database");
            DeployModelTable modelTable = getModelTable();

            for (String envName : envs) {
                Map<String, Object> params = new HashMap<>();
                params.put("env", modelTable.getEnv(envName));
                params.put("jobs", modelTable.getJobs().getJobsInEnv(envName));

                colorPrintln("70", "Generate Jobs for " + envName);
                dslScripts.perform(getRun(), getWorkspace(), getTaskListener(), params);
            }

            return null;
        }
    }

    /**
     * This Builder keeps a list of job DSL scripts, and when prompted, executes these to create /
     * update Jenkins jobs.
     */
    public static class ExecuteDslScripts {

        /**
         * Text of a dsl script.
         */
        private String scriptText;
        private boolean ignoreExisting;
        private boolean ignoreMissingFiles;
        private boolean failOnMissingPlugin;
//        private boolean unstableOnDeprecation;

        private RemovedJobAction removedJobAction = RemovedJobAction.IGNORE;
        private RemovedViewAction removedViewAction = RemovedViewAction.IGNORE;
        private LookupStrategy lookupStrategy = LookupStrategy.JENKINS_ROOT;

        ExecuteDslScripts(String scriptText) {
            this.scriptText = scriptText;
        }

        public LookupStrategy getLookupStrategy() {
            return lookupStrategy == null ? LookupStrategy.JENKINS_ROOT : lookupStrategy;
        }

        /**
         * Runs every job DSL script provided in the plugin configuration, which results in new /
         * updated Jenkins jobs. The created / updated jobs are reported in the build result.
         */
        public void perform(@Nonnull Run<?, ?> run, @Nonnull FilePath workspace, @Nonnull TaskListener listener, Map<String, Object> params) throws InterruptedException, IOException {
            try {
                EnvVars env = run.getEnvironment(listener);
                if (run instanceof AbstractBuild) {
                    env.putAll(((AbstractBuild<?, ?>) run).getBuildVariables());
                }

                Map<String, Object> envVars = new HashMap<>(env);
                envVars.putAll(params);

                JenkinsJobManagement jenkinsJobManagement = new JenkinsJobManagement(
                    listener.getLogger(), envVars, run, workspace, getLookupStrategy()
                );
                jenkinsJobManagement.setFailOnMissingPlugin(failOnMissingPlugin);
                JobManagement jobManagement = new InterruptibleJobManagement(jenkinsJobManagement);

                try (ScriptRequestGenerator generator = new ScriptRequestGenerator(workspace, env)) {
                    Set<ScriptRequest> scriptRequests = generator.getScriptRequests(
                        null, true, scriptText, ignoreExisting, ignoreMissingFiles, null
                    );

                    JenkinsDslScriptLoader dslScriptLoader = new JenkinsDslScriptLoaderForDeploy(jobManagement);

                    GeneratedItems generatedItems = dslScriptLoader.runScripts(scriptRequests);
                    Set<GeneratedJob> freshJobs = generatedItems.getJobs();
                    Set<GeneratedView> freshViews = generatedItems.getViews();
//                    Set<GeneratedConfigFile> freshConfigFiles = generatedItems.getConfigFiles();
                    Set<GeneratedUserContent> freshUserContents = generatedItems.getUserContents();

                    updateTemplates(run.getParent(), listener, freshJobs);
                    updateGeneratedJobs(run.getParent(), listener, freshJobs);
                    updateGeneratedViews(run.getParent(), listener, freshViews);
                    updateGeneratedUserContents(run.getParent(), listener, freshUserContents);

                    // Save onto Builder, which belongs to a Project.
//                    run.addAction(new GeneratedJobsBuildAction(freshJobs, getLookupStrategy()));
//                    run.addAction(new GeneratedViewsBuildAction(freshViews, getLookupStrategy()));
//                    run.addAction(new GeneratedConfigFilesBuildAction(freshConfigFiles));
//                    run.addAction(new GeneratedUserContentsBuildAction(freshUserContents));
                }
            } catch (RuntimeException e) {
                if (!(e instanceof DslException) && !(e instanceof AccessDeniedException)) {
                    e.printStackTrace(listener.getLogger());
                }
                LOG.log(Level.FINE, String.format("Exception while processing DSL scripts: %s", e.getMessage()), e);
                throw new AbortException(e.getMessage());
            }
        }

        /**
         * Uses generatedJobs as existing data, so call before updating generatedJobs.
         */
        private Set<String> updateTemplates(hudson.model.Job seedJob, TaskListener listener,
                                            Set<GeneratedJob> freshJobs) throws IOException {
            Set<String> freshTemplates = getTemplates(freshJobs);
            Set<String> existingTemplates = getTemplates(extractGeneratedObjects(seedJob, GeneratedJobsAction.class));
            Set<String> newTemplates = Sets.difference(freshTemplates, existingTemplates);
            Set<String> removedTemplates = Sets.difference(existingTemplates, freshTemplates);

            logItems(listener, "Existing templates", existingTemplates);
            logItems(listener, "New templates", newTemplates);
            logItems(listener, "Unreferenced templates", removedTemplates);

            // Collect information about the templates we loaded
            final String seedJobName = seedJob.getName();
            javaposse.jobdsl.plugin.DescriptorImpl descriptor = Jenkins.get().getDescriptorByType(javaposse.jobdsl.plugin.DescriptorImpl.class);
            boolean descriptorMutated = false;

            // Clean up
            for (String templateName : removedTemplates) {
                Collection<SeedReference> seedJobReferences = descriptor.getTemplateJobMap().get(templateName);
                Collection<SeedReference> matching = Collections2.filter(seedJobReferences, new SeedNamePredicate(seedJobName));
                if (!matching.isEmpty()) {
                    seedJobReferences.removeAll(matching);
                    descriptorMutated = true;
                }
            }

            // Ensure we have a reference
            for (String templateName : freshTemplates) {
                Collection<SeedReference> seedJobReferences = descriptor.getTemplateJobMap().get(templateName);
                Collection<SeedReference> matching = Collections2.filter(seedJobReferences, new SeedNamePredicate(seedJobName));

                AbstractItem templateProject = getLookupStrategy().getItem(seedJob, templateName, AbstractItem.class);
                final String digest = Util.getDigestOf(new FileInputStream(templateProject.getConfigFile().getFile()));

                if (matching.size() == 1) {
                    // Just update digest
                    SeedReference ref = Iterables.get(matching, 0);
                    if (digest.equals(ref.getDigest())) {
                        ref.setDigest(digest);
                        descriptorMutated = true;
                    }
                } else {
                    if (matching.size() > 1) {
                        // Not sure how there could be more one, throw it all away and start over
                        seedJobReferences.removeAll(matching);
                    }
                    seedJobReferences.add(new SeedReference(templateName, seedJobName, digest));
                    descriptorMutated = true;
                }
            }

            if (descriptorMutated) {
                descriptor.save();
            }
            return freshTemplates;
        }

        private void updateGeneratedJobs(final hudson.model.Job seedJob, TaskListener listener,
                                         Set<GeneratedJob> freshJobs) throws IOException, InterruptedException {
            // Update Project
            Set<GeneratedJob> generatedJobs = extractGeneratedObjects(seedJob, GeneratedJobsAction.class);
            Set<GeneratedJob> added = Sets.difference(freshJobs, generatedJobs);
            Set<GeneratedJob> existing = Sets.intersection(generatedJobs, freshJobs);
            Set<GeneratedJob> unreferenced = Sets.difference(generatedJobs, freshJobs);
            Set<GeneratedJob> removed = new HashSet<>();
            Set<GeneratedJob> disabled = new HashSet<>();

            logItems(listener, "Added items", added);
            logItems(listener, "Existing items", existing);
            logItems(listener, "Unreferenced items", unreferenced);

            // Update unreferenced jobs
            for (GeneratedJob unreferencedJob : unreferenced) {
                Item removedItem = getLookupStrategy().getItem(seedJob, unreferencedJob.getJobName(), Item.class);
                if (removedItem != null && removedJobAction != RemovedJobAction.IGNORE) {
                    if (removedJobAction == RemovedJobAction.DELETE) {
                        removedItem.delete();
                        removed.add(unreferencedJob);
                    } else {
                        if (removedItem instanceof AbstractProject) {
                            AbstractProject project = (AbstractProject) removedItem;
                            project.checkPermission(Item.CONFIGURE);
                            if (project.isInQueue()) {
                                project.checkPermission(Item.CANCEL); // disable() will cancel queued builds
                            }
                            project.disable();
                            disabled.add(unreferencedJob);
                        }
                    }
                }
            }

            // print what happened with unreferenced jobs
            logItems(listener, "Disabled items", disabled);
            logItems(listener, "Removed items", removed);

            updateGeneratedJobMap(seedJob, Sets.union(added, existing), unreferenced);
        }

        private void updateGeneratedJobMap(hudson.model.Job seedJob, Set<GeneratedJob> createdOrUpdatedJobs,
                                           Set<GeneratedJob> removedJobs) throws IOException {
            javaposse.jobdsl.plugin.DescriptorImpl descriptor = Jenkins.getInstance().getDescriptorByType(javaposse.jobdsl.plugin.DescriptorImpl.class);
            boolean descriptorMutated = false;
            Map<String, SeedReference> generatedJobMap = descriptor.getGeneratedJobMap();

            for (GeneratedJob generatedJob : createdOrUpdatedJobs) {
                Item item = getLookupStrategy().getItem(seedJob, generatedJob.getJobName(), Item.class);
                if (item != null) {
                    SeedReference newSeedReference = new SeedReference(seedJob.getFullName());
                    if (generatedJob.getTemplateName() != null) {
                        Item template = getLookupStrategy().getItem(seedJob, generatedJob.getTemplateName(), Item.class);
                        if (template != null) {
                            newSeedReference.setTemplateJobName(template.getFullName());
                        }
                    }
                    newSeedReference.setDigest(Util.getDigestOf(Items.getConfigFile(item).getFile()));

                    SeedReference oldSeedReference = generatedJobMap.get(item.getFullName());
                    if (!newSeedReference.equals(oldSeedReference)) {
                        generatedJobMap.put(item.getFullName(), newSeedReference);
                        descriptorMutated = true;
                    }
                }
            }

            for (GeneratedJob removedJob : removedJobs) {
                Item removedItem = getLookupStrategy().getItem(seedJob, removedJob.getJobName(), Item.class);
                if (removedItem != null) {
                    generatedJobMap.remove(removedItem.getFullName());
                    descriptorMutated = true;
                }
            }

            if (descriptorMutated) {
                descriptor.save();
            }
        }

        private void updateGeneratedViews(hudson.model.Job seedJob, TaskListener listener,
                                          Set<GeneratedView> freshViews) throws IOException {
            Set<GeneratedView> generatedViews = extractGeneratedObjects(seedJob, GeneratedViewsAction.class);
            Set<GeneratedView> added = Sets.difference(freshViews, generatedViews);
            Set<GeneratedView> existing = Sets.intersection(generatedViews, freshViews);
            Set<GeneratedView> unreferenced = Sets.difference(generatedViews, freshViews);
            Set<GeneratedView> removed = new HashSet<>();

            logItems(listener, "Added views", added);
            logItems(listener, "Existing views", existing);
            logItems(listener, "Unreferenced views", unreferenced);

            // Delete views
            if (removedViewAction == RemovedViewAction.DELETE) {
                for (GeneratedView unreferencedView : unreferenced) {
                    String viewName = unreferencedView.getName();
                    ItemGroup parent = getLookupStrategy().getParent(seedJob, viewName);
                    if (parent instanceof ViewGroup) {
                        hudson.model.View view = ((ViewGroup) parent).getView(FilenameUtils.getName(viewName));
                        if (view != null) {
                            view.checkPermission(View.DELETE);
                            ((ViewGroup) parent).deleteView(view);
                            removed.add(unreferencedView);
                        }
                    } else if (parent == null) {
                        LOG.log(Level.FINE, "Parent ViewGroup seems to have been already deleted");
                    } else {
                        LOG.log(Level.WARNING, format("Could not delete view within %s", parent.getClass()));
                    }
                }
            }

            logItems(listener, "Removed views", removed);
        }

        private void updateGeneratedUserContents(Job seedJob, TaskListener listener,
                                                 Set<GeneratedUserContent> freshUserContents) {
            Set<GeneratedUserContent> generatedUserContents = extractGeneratedObjects(seedJob, GeneratedUserContentsAction.class);
            Set<GeneratedUserContent> added = Sets.difference(freshUserContents, generatedUserContents);
            Set<GeneratedUserContent> existing = Sets.intersection(generatedUserContents, freshUserContents);
            Set<GeneratedUserContent> unreferenced = Sets.difference(generatedUserContents, freshUserContents);

            logItems(listener, "Adding user content", added);
            logItems(listener, "Existing user content", existing);
            logItems(listener, "Unreferenced user content", unreferenced);
        }

        private void logItems(TaskListener listener, String message, Collection<?> collection) {
            if (!collection.isEmpty()) {
                listener.getLogger().println(message + ":");
                for (Object item : collection) {
                    listener.getLogger().println("    " + item.toString());
                }
            }
        }

        private Set<String> getTemplates(Collection<GeneratedJob> jobs) {
            Collection<String> templateNames = Collections2.transform(jobs, new Function<GeneratedJob, String>() {
                @Override
                public String apply(GeneratedJob input) {
                    return input.getTemplateName();
                }
            });
            return new LinkedHashSet<>(Collections2.filter(templateNames, Predicates.notNull()));
        }

        private static class SeedNamePredicate implements Predicate<SeedReference> {
            private final String seedJobName;

            SeedNamePredicate(String seedJobName) {
                this.seedJobName = seedJobName;
            }

            @Override
            public boolean apply(SeedReference input) {
                return seedJobName.equals(input.getSeedJobName());
            }
        }
    }

    private static class JenkinsDslScriptLoaderForDeploy extends JenkinsDslScriptLoader {
        public JenkinsDslScriptLoaderForDeploy(JobManagement jobManagement) {
            super(jobManagement);
        }

        /**
         * Executes the script requests and returns the generated items.
         *
         * @param scriptRequests
         * @since 1.45
         */
        @Override
        public GeneratedItems runScripts(Collection<ScriptRequest> scriptRequests) throws IOException {
            try {
                GeneratedItems generatedItems = generatedItemsClass.newInstance();
                CompilerConfiguration config = createCompilerConfiguration();
                this.customizeCompilerConfiguration(config);
                for (ScriptRequest scriptRequest : scriptRequests) {
                    GroovyShell groovyShell = new GroovyShell(
                        DeployCompiler.getInstance().DEPLOY_CLASSLOADER,
                        new Binding(),
                        config
                    );
                    JenkinsJobParent jobParent = runScriptEngine(scriptRequest, groovyShell);
                    extractGeneratedItems(generatedItems, jobParent, scriptRequest);
                    scheduleJobsToRun(jobParent.getQueueToBuild());
                }
                return generatedItems;
            } catch (InstantiationException | IllegalAccessException e) {
                throw new IllegalStateException(e);
            }
        }

        private void customizeCompilerConfiguration(CompilerConfiguration config) {
            config.setScriptBaseClass(scriptBaseClass.getName());

            // Import some of our helper classes so that user doesn"t have to.
            ImportCustomizer icz = new ImportCustomizer();
            icz.addImports("javaposse.jobdsl.dsl.helpers.publisher.ArchiveXUnitContext.ThresholdMode");
            icz.addImports("javaposse.jobdsl.dsl.helpers.publisher.PublisherContext.Behavior");
            icz.addImports("javaposse.jobdsl.dsl.helpers.step.RunConditionContext.BaseDir");
            icz.addImports("javaposse.jobdsl.dsl.views.ListView.StatusFilter");
            icz.addImports("javaposse.jobdsl.dsl.views.BuildPipelineView.OutputStyle");
            icz.addImports("javaposse.jobdsl.dsl.views.DeliveryPipelineView.Sorting");
            icz.addImports("javaposse.jobdsl.dsl.views.jobfilter.AmountType");
            icz.addImports("javaposse.jobdsl.dsl.views.jobfilter.BuildCountType");
            icz.addImports("javaposse.jobdsl.dsl.views.jobfilter.BuildStatusType");
            icz.addImports("javaposse.jobdsl.dsl.views.jobfilter.Status");
            icz.addImports("javaposse.jobdsl.dsl.views.jobfilter.MatchType");
            icz.addImports("javaposse.jobdsl.dsl.views.jobfilter.RegexMatchValue");
            icz.addImports("javaposse.jobdsl.dsl.views.portlets.TestTrendChartContext.DisplayStatus");
            icz.addImports("javaposse.jobdsl.dsl.helpers.scm.SvnCheckoutStrategy");
            icz.addImports("javaposse.jobdsl.dsl.helpers.scm.SvnDepth");
            icz.addImports("javaposse.jobdsl.dsl.helpers.scm.GitMergeOptionsContext.FastForwardMergeMode");
            icz.addImports("javaposse.jobdsl.dsl.helpers.LocalRepositoryLocation");
            icz.addImports("javaposse.jobdsl.dsl.helpers.publisher.WeblogicDeployerContext.WeblogicDeploymentStageModes");
            icz.addImports("javaposse.jobdsl.dsl.helpers.triggers.BuildResultTriggerContext.BuildResult");
            config.addCompilationCustomizers(icz);
        }
    }

    @Extension
    public static class DescriptorImpl extends StepDescriptor {
        /**
         * Enumerates any kinds of context the {@link StepExecution} will treat as mandatory.
         * When {@link StepContext#get} is called, the return value may be null in general;
         * if your step cannot trivially handle a null value of a given kind, list that type here.
         * The Pipeline execution engine will then signal a user error before even starting your step if called in an inappropriate context.
         * For example, a step requesting a {@link Launcher} may only be run inside a {@code node {…}} block.
         *
         * @return typically an {@link ImmutableSet#of(Object)} with context types like {@link TaskListener} or {@link Run} or {@link FilePath}
         */
        @Override
        public Set<? extends Class<?>> getRequiredContext() {
            return ImmutableSet.of(Run.class, Launcher.class, FilePath.class);
        }

        /**
         * Return a short string that is a valid identifier for programming languages.
         * Follow the pattern {@code [a-z][A-Za-z0-9_]*}.
         * Step will be referenced by this name when used in a programming language.
         */
        @Override
        public String getFunctionName() {
            return "generateJobs";
        }

        /**
         * Human readable name of this kind of configurable object.
         * Should be overridden for most descriptors, if the display name is visible somehow.
         * As a fallback it uses {@link Class#getSimpleName} on {@link #clazz}, so for example {@code MyThing} from {@code some.pkg.MyThing.DescriptorImpl}.
         * Historically some implementations returned null as a way of hiding the descriptor from the UI,
         * but this is generally managed by an explicit method such as {@code isEnabled} or {@code isApplicable}.
         */
        @Nonnull
        @Override
        public String getDisplayName() {
            return "Generate Jobs";
        }
    }
}
