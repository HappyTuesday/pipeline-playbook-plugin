package com.yit.deploy.plugin.steps.tasks;

public class SleepTask extends AbstractJenkinsTask {

    private long time;

    public void setTime(long time) {
        this.time = time;
    }

    /**
     * starts the step and blocking util the step to complete or throw exceptions if failed.
     */
    @Override
    public Object start() throws InterruptedException {
        Thread.sleep(time);
        return null;
    }

    /**
     * gracefully stop this step if it is running from another thread.
     */
    @Override
    public void stop() {
        Thread.currentThread().interrupt();
    }
}
