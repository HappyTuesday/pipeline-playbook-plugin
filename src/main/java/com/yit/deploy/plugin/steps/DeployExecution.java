package com.yit.deploy.plugin.steps;

import com.yit.deploy.core.config.DeployConfig;
import com.yit.deploy.core.control.DeployService;
import com.yit.deploy.core.exceptions.ExitException;
import com.yit.deploy.core.exceptions.RenderTemplateException;
import com.yit.deploy.core.exceptions.TaskExecutionException;
import com.yit.deploy.core.model.DeployModelTable;
import com.yit.deploy.core.model.PipelineScript;
import com.yit.deploy.core.model.PipelineScriptSteps;
import com.yit.deploy.plugin.Locker;
import com.yit.deploy.plugin.steps.tasks.*;
import hudson.*;
import hudson.console.ConsoleAnnotator;
import hudson.console.ConsoleLogFilter;
import hudson.console.ConsoleNote;
import hudson.console.LineTransformationOutputStream;
import hudson.model.*;
import hudson.plugins.ansicolor.AnsiColorBuildWrapper;
import hudson.plugins.ansicolor.AnsiColorConsoleLogFilter;
import hudson.plugins.ansicolor.AnsiColorMap;
import hudson.util.DaemonThreadFactory;
import hudson.util.NamingThreadFactory;
import jenkins.model.Jenkins;
import org.acegisecurity.Authentication;
import org.acegisecurity.context.SecurityContextHolder;
import org.jenkinsci.plugins.workflow.cps.CpsThread;
import org.jenkinsci.plugins.workflow.steps.*;
import org.jenkinsci.plugins.workflow.support.DefaultStepContext;

import javax.annotation.Nonnull;
import java.io.IOException;
import java.io.OutputStream;
import java.io.Serializable;
import java.lang.reflect.Field;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import java.util.logging.Level;
import java.util.logging.Logger;

public abstract class DeployExecution extends AbstractStepExecutionImpl {

    private static final Logger LOG = Logger.getLogger(DeployExecution.class.getName());

    private static final String COLOR_MAP_NAME = "xterm";

    private static final long serialVersionUID = 1L;

    private static Field CONTEXT_VARIABLES_VALUES_FIELD;
    private static Field STEP_CONTEXT_TASK_LISTENER_FIELD;

    private transient CpsThread currentCpsThread;
    private transient Future rootTaskFuture;
    private transient final List<JenkinsTask> runningTasks = new LinkedList<>();
    private static transient ExecutorService executorService;
    private transient ThreadLocal<String> loggingPrefix = new ThreadLocal<>();
    private transient TaskListener taskListener;
    private EnvVars envvars;
    private FilePath workspace;
    private transient PipelineScriptSteps steps;
    private Authentication authentication;
    private String jobName;
    private transient ThreadLocal<FilePath> pwd;

    public static synchronized ExecutorService getExecutorService() {
        if (executorService == null) {
            ThreadFactory f = new ClassloaderThreadFactory();
            f = new DaemonThreadFactory(f);
            f = new NamingThreadFactory(f, "deploy-execution");

            executorService =  new ThreadPoolExecutor(0, 512,
                600L, TimeUnit.SECONDS,
                new SynchronousQueue<>(),
                f
            );
        }
        return executorService;
    }

    public DeployExecution(@Nonnull StepContext context) {
        super(context);
    }

    public synchronized FilePath getPwd() {
        if (pwd == null) {
            pwd = new ThreadLocal<>();
        }

        if (pwd.get() == null) {
            pwd.set(workspace);
        }

        return pwd.get();
    }

    public synchronized void setPwd(FilePath value) {
        if (pwd == null) {
            pwd = new ThreadLocal<>();
        }
        pwd.set(value);
    }

    public String getJobName() {
        return jobName;
    }

    public Run getRun() {
        return getContextVariable(Run.class);
    }

    public Launcher getLauncher() {
        return getContextVariable(Launcher.class);
    }

    public FilePath getWorkspace() {
        return workspace;
    }

    /**
     * Start execution of something and report the end result back to the given callback.
     *
     * Arguments are passed when {@linkplain StepDescriptor#newInstance(Map) instantiating steps}.
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
    @SuppressWarnings("unchecked")
    @Override
    public synchronized boolean start() {
        if (rootTaskFuture != null) {
            throw new IllegalStateException("root task future is not null");
        }

        currentCpsThread = CpsThread.current();
        authentication = Jenkins.getAuthentication();
        setupConsoleLogFilter();
        workspace = getContextVariable(FilePath.class);
        envvars = getContextVariable(EnvVars.class);
        jobName = envvars.get("JOB_NAME");
        steps = new PipelineScriptStepsSupport(this);

        rootTaskFuture = schedule(() -> {
            try {
                Object result = DeployExecution.this.run();
                getContext().onSuccess(result);
            } catch (Throwable t) {
                LOG.log(Level.WARNING, "execute job " + jobName + " failed", t);
                getContext().onFailure(new AbortException(t.getMessage()));
            }
        });

        return false;
    }

    /**
     * actual run logic
     * @throws Exception
     */
    protected abstract Object run() throws Exception;

    /**
     * May be called if someone asks a running step to abort.
     *
     * Just like {@link Thread#interrupt()},
     * the step might not honor the request immediately.
     * Multiple stop requests might be sent.
     * It is always responsible for calling {@link StepContext#onSuccess(Object)} or (more likely)
     * {@link StepContext#onFailure(Throwable)} eventually,
     * whether or not it was asked to stop.
     *
     * <p>
     * In the workflow context, this method is meant to be used by {@code FlowExecution}, and not
     * to be called willy-nilly from UI or other human requests to pause. Use {@link BodyExecution#cancel(Throwable)}.
     *
     * @param cause
     *      Contextual information that lets the step know what resulted in stopping an executing step,
     *      passed in the hope that this will assist diagnostics.
     */
    @Override
    public synchronized void stop(@Nonnull Throwable cause) {
        List<JenkinsTask> tasks;
        synchronized (runningTasks) {
            tasks = new ArrayList<>(runningTasks);
        }
        List<Exception> errors = new LinkedList<>();
        for (int i = tasks.size() - 1; i >= 0; i--) {
            JenkinsTask task = tasks.get(i);
            try {
                task.stop();
            } catch (Exception e) {
                errors.add(e);
            }
        }
        if (!errors.isEmpty()) {
            println("error occurred while stopping: ");
            for (Exception e : errors) {
                println(e.getMessage());
            }
        }
        if (rootTaskFuture != null && !rootTaskFuture.isDone()) {
            rootTaskFuture.cancel(true);
        } else {
            getContext().onFailure(cause);
        }
    }

    @Override
    public void onResume() {
        Throwable t = new AbortException("Resume after a restart is not supported currently");
        try {
            stop(t);
        } catch (Exception e) {
            LOG.log(Level.WARNING, "stop failed", e);
        }
    }

    public Future<?> schedule(Runnable runnable) {
        return getExecutorService().submit(() -> {

            Authentication originAuth = Jenkins.getAuthentication();
            SecurityContextHolder.getContext().setAuthentication(authentication);
            String originThreadName = Thread.currentThread().getName();
            Thread.currentThread().setName(originThreadName + " (" + jobName + "@" + UUID.randomUUID() + ")");

            try {
                runnable.run();
            } finally {
                Thread.currentThread().setName(originThreadName);
                SecurityContextHolder.getContext().setAuthentication(originAuth);
            }
        });
    }

    private void setupConsoleLogFilter() {
        ConsoleLogFilter filter = getContextVariable(ConsoleLogFilter.class);
        filter = new MergedFilter(filter, new LoggingPrefixFilter(this));
        filter = new MergedFilter(filter, getAnsiColorFilter());
        clearTaskListener();
        setContextVariable(ConsoleLogFilter.class, filter);
        getContextVariable(TaskListener.class);
        getContextVariable(EnvVars.class).put("TERM", COLOR_MAP_NAME);
    }

    private void clearTaskListener() {
        try {
            if (STEP_CONTEXT_TASK_LISTENER_FIELD == null) { // multi intance is OK
                STEP_CONTEXT_TASK_LISTENER_FIELD = DefaultStepContext.class.getDeclaredField("listener");
                STEP_CONTEXT_TASK_LISTENER_FIELD.setAccessible(true);
            }
            TaskListener listener = (TaskListener) STEP_CONTEXT_TASK_LISTENER_FIELD.get(getContext());
            if (listener != null) {
                STEP_CONTEXT_TASK_LISTENER_FIELD.set(getContext(), null);
                listener.getLogger().close();
            }
        } catch (NoSuchFieldException | IllegalAccessException e) {
            throw new IllegalStateException(e);
        }
    }

    private ConsoleLogFilter getAnsiColorFilter() {
        AnsiColorBuildWrapper.DescriptorImpl descriptor = Jenkins.get().getDescriptorByType(AnsiColorBuildWrapper.DescriptorImpl.class);
        AnsiColorMap colorMap = descriptor.getColorMap(COLOR_MAP_NAME);
        return new AnsiColorConsoleLogFilter(colorMap);
    }

    @SuppressWarnings("unchecked")
    public <T> T getContextVariable(Class<T> clazz) {
        try {
            //resetCurrentThreadAsCps();
            return getContext().get(clazz);
        } catch (IOException | InterruptedException e) {
            throw new IllegalStateException(e);
        }
    }

    @SuppressWarnings("unchecked")
    public <T> void setContextVariable(Class<T> clazz, T value) {
        try {
            Object vs = currentCpsThread.getContextVariables();
            if (CONTEXT_VARIABLES_VALUES_FIELD == null) { // multi instance is OK
                CONTEXT_VARIABLES_VALUES_FIELD = vs.getClass().getDeclaredField("values");
                CONTEXT_VARIABLES_VALUES_FIELD.setAccessible(true);
            }
            List<Object> values = (List<Object>) CONTEXT_VARIABLES_VALUES_FIELD.get(vs);
            for (int i = 0; i < values.size(); i++) {
                if (clazz.isInstance(values.get(i))) {
                    values.set(i, value);
                    return;
                }
            }
            values.add(value);
        } catch (NoSuchFieldException | IllegalAccessException e) {
            throw new IllegalStateException(e);
        }
    }

    public <T extends AbstractJenkinsTask> T createTask(Class<T> clazz) {
        try {
            T task = clazz.newInstance();
            task.setExecution(this);
            return task;
        } catch (InstantiationException | IllegalAccessException e) {
            throw new IllegalStateException(e);
        }
    }

    public Object executeTask(JenkinsTask task) throws TaskExecutionException {
        onTaskStarted(task);
        try {
            return task.start();
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new TaskExecutionException(e);
        } finally {
            onTaskCompleted(task);
        }
    }

    private void onTaskStarted(JenkinsTask task) {
        synchronized (runningTasks) {
            runningTasks.add(task);
        }
    }

    private void onTaskCompleted(JenkinsTask task) {
        synchronized (runningTasks) {
            runningTasks.remove(task);
        }
    }

    public String getLoggingPrefix() {
        return loggingPrefix == null ? null : loggingPrefix.get();
    }

    public void setLoggingPrefix(String prefix) {
        loggingPrefix.set(prefix);
    }

    public TaskListener getTaskListener() {
        if (taskListener == null) {
            taskListener = getContextVariable(TaskListener.class);
        }
        return taskListener;
    }

    public void println(String text) {
        getTaskListener().getLogger().println(text);
    }

    public void print(String text) {
        getTaskListener().getLogger().print(text);
    }

    public void printf(String format, Object ... args) {
        getTaskListener().getLogger().printf(format, args);
    }

    public void colorPrintln(String color, String message) {
        getTaskListener().getLogger().printf("\033[38;5;%sm%s\033[m%n", color, message);
    }

    public void printError(String message) {
        colorPrintln("196", message);
    }

    public EnvVars getEnvvars() {
        return envvars;
    }

    public PipelineScriptSteps getSteps() {
        return steps;
    }

    public DeployModelTable getModelTable() {
        return DeployGlobalConfiguration.get().getModelTable();
    }

    public DeployService getDeployService() {
        return DeployGlobalConfiguration.get().getDeployService();
    }

    public DeployConfig getDeployConfig() {
        return DeployGlobalConfiguration.get().getDeployConfig();
    }

    public PipelineScript createPipelineScript() {
        return new PipelineScript(getSteps(), getEnvvars());
    }

    static class LoggingPrefixFilter extends ConsoleLogFilter implements Serializable {
        private static final long serialVersionUID = 1;
        private final DeployExecution execution;

        LoggingPrefixFilter(DeployExecution execution) {
            this.execution = execution;
        }

        @Override public OutputStream decorateLogger(AbstractBuild _ignore, OutputStream logger) {
            if (logger == null) {
                return null;
            }

            return new LineTransformationOutputStream() {
                @Override
                protected void eol(byte[] b, int len) throws IOException {
                    String prefix = execution.getLoggingPrefix();
                    if (prefix != null && !prefix.isEmpty()) {
                        String span = String.format("<span style=\"color:#9A9999\">[%s] </span>", prefix);
                        try {
                            new SimpleHtmlNote(span).encodeTo(logger);
                        } catch (Exception e) {
                            LOG.log(Level.WARNING, "Failed to add HTML markup '" + span + "'", e);
                        }
                    }
                    logger.write(b, 0, len);
                    logger.flush();
                }

                @Override
                public void close() throws IOException {
                    logger.close();
                    super.close();
                }
            };
        }
    }

    static class SimpleHtmlNote extends ConsoleNote<Object> {
        private String tagHtml;

        SimpleHtmlNote(String tagHtml) {
            this.tagHtml = tagHtml;
        }

        @Override
        public ConsoleAnnotator annotate(Object context, MarkupText text, int charPos) {
            text.addMarkup(charPos, tagHtml);
            return null;
        }
    }

    static class MergedFilter extends ConsoleLogFilter implements Serializable {
        private static final long serialVersionUID = 1;
        private final ConsoleLogFilter original, subsequent;
        MergedFilter(ConsoleLogFilter original, ConsoleLogFilter subsequent) {
            this.original = original;
            this.subsequent = subsequent;
        }

        @SuppressWarnings({"rawtypes", "deprecation"}) // not my fault
        @Override public OutputStream decorateLogger(AbstractBuild _ignore, OutputStream logger) throws IOException, InterruptedException {
            if (original != null) {
                logger = original.decorateLogger(_ignore, logger);
            }
            return subsequent.decorateLogger(_ignore, logger);
        }
    }

    static class ClassloaderThreadFactory implements ThreadFactory {

        /**
         * Constructs a new {@code Thread}.  Implementations may also initialize
         * priority, name, daemon status, {@code ThreadGroup}, etc.
         *
         * @param r a runnable to be executed by new thread instance
         * @return constructed thread, or {@code null} if the request to
         * create a thread is rejected
         */
        @Override
        public Thread newThread(Runnable r) {
            Thread t = new Thread(r);
            t.setContextClassLoader(Jenkins.get().getPluginManager().uberClassLoader);
            return t;
        }
    }
}