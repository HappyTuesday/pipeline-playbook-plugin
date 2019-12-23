package com.yit.deploy.plugin.steps.tasks;

import com.yit.deploy.core.utils.Utils;
import com.yit.deploy.plugin.Locker;
import hudson.AbortException;
import hudson.Extension;
import hudson.Functions;
import hudson.console.ConsoleAnnotationDescriptor;
import hudson.console.HyperlinkNote;
import hudson.model.*;
import hudson.util.HttpResponses;
import jenkins.model.Jenkins;
import org.kohsuke.accmod.Restricted;
import org.kohsuke.accmod.restrictions.DoNotUse;
import org.kohsuke.stapler.HttpResponse;
import org.kohsuke.stapler.Stapler;
import org.kohsuke.stapler.StaplerRequest;
import org.kohsuke.stapler.interceptor.RequirePOST;

import javax.annotation.CheckForNull;
import javax.annotation.Nonnull;
import java.io.IOException;
import java.io.PrintStream;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.logging.Level;
import java.util.logging.Logger;

public class InputTask extends AbstractJenkinsTask {

    private static final long serialVersionUID = -1;

    private List<String> options;
    private String message;

    private final Map<String, String> optionsMap = new HashMap<>();
    private final Object waitForInputLock = new Locker();
    private volatile String outcome;
    private String error;
    private transient User operator;

    public void setOptions(List<String> options) {
        this.options = options;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    /**
     * starts the step and blocking util the step to complete or throw exceptions if failed.
     */
    @Override
    public Object start() throws AbortException, InterruptedException, UnsupportedEncodingException {
        if (outcome != null || error != null) {
            throw new IllegalStateException("outcome / abnormal is not null");
        }

        InputAction action = getInputAction();
        action.addTask(this);
        PrintStream out = getTaskListener().getLogger();
        out.println(message + ": ");
        optionsMap.clear();

        for (int i = 0; i < options.size(); i++) {
            String choice = options.get(i);
            optionsMap.put(URLEncoder.encode(choice, Utils.DefaultCharset.name()), choice);
            String url = action.getFullUrlFor(this, choice);
            out.print(POSTHyperlinkNote.encodeTo(url, optionsMap.get(choice)) + " ");
        }
        out.println();
        synchronized (waitForInputLock) {
            while (error == null && outcome == null) {
                waitForInputLock.wait();
            }
        }
        if (error != null) {
            throw new AbortException(error);
        }
        if (operator == null) {
            getExecution().printf("%s is selected\n", outcome);
        } else {
            getExecution().printf("%s is selected by %s\n", outcome, hudson.console.ModelHyperlinkNote.encodeTo(operator));
        }
        return outcome;
    }

    /**
     * gracefully stop this step if it is running from another thread.
     */
    @Override
    public void stop() {
        synchronized (waitForInputLock) {
            error = "cancel is request";
            waitForInputLock.notifyAll();
        }
        getInputAction().removeTask(this);
    }

    @Nonnull
    private InputAction getInputAction() {
        final Run run = getRun();
        InputAction a = run.getAction(InputAction.class);
        if (a == null) {
            synchronized (run) {
                a = run.getAction(InputAction.class);
                if (a == null) {
                    a = new InputAction(getRun());
                    run.addAction(a);
                }
            }
        }
        return a;
    }

    private void onSelected(String choice) {
        synchronized (waitForInputLock) {
            outcome = choice;
            waitForInputLock.notifyAll();
            operator = User.current();
        }
        getInputAction().removeTask(this);
    }

    /**
     * Hyperlink which sends a POST request to the specified URL.
     */
    public static class POSTHyperlinkNote extends HyperlinkNote {

        private static final Logger LOGGER = Logger.getLogger(POSTHyperlinkNote.class.getName());

        public static String encodeTo(String url, String text) {
            try {
                return new POSTHyperlinkNote(url, text.length()).encode() + text;
            } catch (IOException e) {
                // impossible, but don't make this a fatal problem
                LOGGER.log(Level.WARNING, "Failed to serialize " + POSTHyperlinkNote.class, e);
                return text;
            }
        }

        private final String url;

        public POSTHyperlinkNote(String url, int length) {
            super("#", length);
            if (url.startsWith("/")) {
                StaplerRequest req = Stapler.getCurrentRequest();
                // When req is not null?
                if (req != null) {
                    url = req.getContextPath() + url;
                } else {
                    Jenkins j = Jenkins.getInstance();
                    String rootUrl = j.getRootUrl();
                    if (rootUrl != null) {
                        url = rootUrl + url.substring(1);
                    } else {
                        // hope that / works, i.e., that there is no context path
                        // TODO: Does not works when there is a content path, p.e. http://localhost:8080/jenkins
                        // This message log should be an error.
                        LOGGER.warning("You need to define the root URL of Jenkins");
                    }
                }
            }
            this.url = url;
        }

        @Override protected String extraAttributes() {
            // TODO perhaps add hoverNotification
            return " onclick=\"new Ajax.Request('" + url + "'); return false\"";
        }

        // TODO why does there need to be a descriptor at all?
        @Extension
        public static final class DescriptorImpl extends ConsoleAnnotationDescriptor {
            @Override public String getDisplayName() {
                return "POST Hyperlinks";
            }
        }

    }

    public static class InputAction implements Action {

        private transient Run run;

        private transient Map<InputTask, Integer> tasks;
        private transient int nextId;

        public InputAction(Run run) {
            this.run = run;
            nextId = 1;
        }

        private synchronized Map<InputTask, Integer> getTasks () {
            if (tasks == null) {
                tasks = new HashMap<>();
            }
            return tasks;
        }

        public void addTask(InputTask task) {
            synchronized (getTasks()) {
                tasks.put(task, nextId++);
            }
        }

        public void removeTask(InputTask task) {
            synchronized (getTasks()) {
                tasks.remove(task);
            }
        }

        private Integer getTaskId(InputTask task) {
            synchronized (getTasks()) {
                return tasks.get(task);
            }
        }

        private InputTask getTaskById(int taskId) {
            synchronized (getTasks()) {
                for (Map.Entry<InputTask, Integer> entry : tasks.entrySet()) {
                    if (entry.getValue() == taskId) {
                        return entry.getKey();
                    }
                }

                return null;
            }
        }

        public String getFullUrl() {
            return "/" + (run != null ? run.getUrl() : "") + this.getUrlName() + "/select";
        }

        public String getFullUrlFor(InputTask task, String choice) {
            Integer taskId = getTaskId(task);
            if (taskId == null) throw new IllegalArgumentException("input task is not added");
            return String.format("%s?taskId=%s&choice=%s", getFullUrl(), taskId, choice);
        }

        @Restricted(DoNotUse.class)
        @RequirePOST
        public HttpResponse doSelect(StaplerRequest request) {
            String taskIdString = request.getParameter("taskId");
            if (taskIdString == null || taskIdString.isEmpty()) {
                return HttpResponses.error(400, "parameter taskId is missing");
            }
            int taskId = Integer.parseInt(taskIdString);
            InputTask task = getTaskById(taskId);
            if (task == null) {
                return HttpResponses.error(400, "invalid taskId " + taskId);
            }
            String choice = request.getParameter("choice");
            if (choice == null || choice.isEmpty()) {
                return HttpResponses.error(400, "parameter choice is missing");
            }
            task.onSelected(choice);
            return HttpResponses.ok();
        }

        /**
         * Gets the file name of the icon.
         *
         * @return If just a file name (like "abc.gif") is returned, it will be
         * interpreted as a file name inside <tt>/images/24x24</tt>.
         * This is useful for using one of the stock images.
         * <p>
         * If an absolute file name that starts from '/' is returned (like
         * "/plugin/foo/abc.gif'), then it will be interpreted as a path
         * from the context root of Jenkins. This is useful to pick up
         * image files from a plugin.
         * <p>
         * Finally, return null to hide it from the task list. This is normally not very useful,
         * but this can be used for actions that only contribute <tt>floatBox.jelly</tt>
         * and no task list item. The other case where this is useful is
         * to avoid showing links that require a privilege when the user is anonymous.
         * @see Functions#isAnonymous()
         * @see Functions#getIconFilePath(Action)
         */
        @CheckForNull
        @Override
        public String getIconFileName() {
            return null;
        }

        /**
         * Gets the string to be displayed.
         * <p>
         * The convention is to capitalize the first letter of each word,
         * such as "Test Result".
         *
         * @return Can be null in case the action is hidden.
         */
        @CheckForNull
        @Override
        public String getDisplayName() {
            return "Input";
        }

        /**
         * Gets the URL path name.
         * <p>
         * <p>
         * For example, if this method returns "xyz", and if the parent object
         * (that this action is associated with) is bound to /foo/bar/zot,
         * then this action object will be exposed to /foo/bar/zot/xyz.
         * <p>
         * <p>
         * This method should return a string that's unique among other {@link Action}s.
         * <p>
         * <p>
         * The returned string can be an absolute URL, like "http://www.sun.com/",
         * which is useful for directly connecting to external systems.
         * <p>
         * <p>
         * If the returned string starts with '/', like '/foo', then it's assumed to be
         * relative to the context path of the Jenkins webapp.
         *
         * @return null if this action object doesn't need to be bound to web
         * (when you do that, be sure to also return null from {@link #getIconFileName()}.
         * @see Functions#getActionUrl(String, Action)
         */
        @CheckForNull
        @Override
        public String getUrlName() {
            return "input";
        }
    }
}
