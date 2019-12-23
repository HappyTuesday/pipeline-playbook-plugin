package com.yit.deploy.plugin.steps.tasks;

import com.yit.deploy.core.exceptions.ParallelExecutionException;
import com.yit.deploy.plugin.steps.DeployExecution;
import hudson.AbortException;
import hudson.FilePath;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Future;
import java.util.logging.Level;
import java.util.logging.Logger;

public class ParallelTask extends AbstractJenkinsTask {
    private static final long serialVersionUID = -1;
    private static Logger logger = Logger.getLogger(ParallelTask.class.getName());

    private Map<String, Runnable>  map;

    private transient volatile Map<String, Future> futures;

    public void setMap(Map<String, Runnable> map) {
        this.map = map;
    }

    /**
     * starts the step and blocking util the step to complete or throw exceptions if failed.
     */
    @Override
    public Object start() {
        if (futures != null) {
            throw new IllegalStateException("futures is not null");
        }
        String parentLoggingPrefix = getExecution().getLoggingPrefix();
        FilePath parentPwd = getExecution().getPwd();
        Map<String, Future> futures = new HashMap<>();
        Map<String, Throwable> errors = new ConcurrentHashMap<>();

        for (Map.Entry<String, Runnable> entry : map.entrySet()) {
            String name = entry.getKey();
            Runnable body = entry.getValue();
            Future future = getExecution().schedule(() -> {

                DeployExecution execution = getExecution();
                String originLoggingPrefix = execution.getLoggingPrefix();
                String loggingPrefix = name;
                if (parentLoggingPrefix != null) loggingPrefix = parentLoggingPrefix + "|" + loggingPrefix;
                execution.setLoggingPrefix(loggingPrefix);
                FilePath originPwd = execution.getPwd();
                execution.setPwd(parentPwd);

                try {
                    body.run();
                } catch (Throwable t) {
                    String errorMessage = String.format("execute parallel task %s of job %s failed",
                        name, execution.getJobName());

                    logger.log(Level.WARNING, errorMessage, t);
                    execution.printError(t.getMessage());
                    errors.put(name, t);
                } finally {
                    execution.setPwd(originPwd);
                    execution.setLoggingPrefix(originLoggingPrefix);
                }
            });

            futures.put(name, future);
        }

        this.futures = futures;
        for (String name : futures.keySet()) {
            Future future = futures.get(name);
            try {
                future.get();
            } catch (Throwable t) {
                errors.put(name, t);
            }
        }

        this.futures = null;

        if (errors.isEmpty()) {
            return null;
        } else {
            throw new ParallelExecutionException(errors);
        }
    }

    /**
     * gracefully stop this step if it is running from another thread.
     */
    @Override
    public void stop() {
        Map<String, Future> futures = this.futures;
        if (futures != null) {
            for (Future future : futures.values()) {
                if (!future.isDone()) {
                    future.cancel(true);
                }
            }
        }
    }
}
