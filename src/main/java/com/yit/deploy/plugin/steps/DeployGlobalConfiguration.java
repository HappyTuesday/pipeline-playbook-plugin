package com.yit.deploy.plugin.steps;

import com.yit.deploy.core.config.ConfigProject;
import com.yit.deploy.core.config.DeployConfig;
import com.yit.deploy.core.control.DeployService;
import com.yit.deploy.core.info.DeployInfoTable;
import com.yit.deploy.core.model.DeployModelTable;
import com.yit.deploy.core.storage.StorageConfig;
import hudson.Extension;
import hudson.FilePath;
import jenkins.model.GlobalConfiguration;
import jenkins.model.Jenkins;
import net.sf.json.JSONObject;
import org.kohsuke.stapler.DataBoundSetter;
import org.kohsuke.stapler.StaplerRequest;

import javax.annotation.Nonnull;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Created by nick on 29/12/2017.
 */
@Extension
public class DeployGlobalConfiguration extends GlobalConfiguration {
    public static @Nonnull DeployGlobalConfiguration get() {
        DeployGlobalConfiguration instance = all().get(DeployGlobalConfiguration.class);
        if (instance == null) {
            throw new IllegalStateException();
        }
        return instance;
    }

    @DataBoundSetter
    private String projectRepositoryUrl;

    @DataBoundSetter
    private String projectBranch;

    @DataBoundSetter
    private String localPath = "${JENKINS_HOME}/playbook-pipeline/config";

    @DataBoundSetter
    private long maxDelay = 1000;

    @DataBoundSetter
    private String storageUrl;

    @DataBoundSetter
    private String storageUsername;

    @DataBoundSetter
    private String storagePassword;

    @DataBoundSetter
    private String storageBranch = "master";

    @DataBoundSetter
    private String envs;

    public DeployGlobalConfiguration() {
        load();
    }

    @Override
    public boolean configure(StaplerRequest req, JSONObject json) {
        req.bindJSON(this, json);
        save();
        return true;
    }

    public String getLocalPath() {
        return localPath;
    }

    public String getProjectBranch() {
        return projectBranch;
    }

    public String getProjectRepositoryUrl() {
        return projectRepositoryUrl;
    }

    public void setLocalPath(String localPath) {
        this.localPath = localPath;
    }

    public void setProjectBranch(String projectBranch) {
        this.projectBranch = projectBranch;
    }

    public void setProjectRepositoryUrl(String projectRepositoryUrl) {
        this.projectRepositoryUrl = projectRepositoryUrl;
    }

    public long getMaxDelay() {
        return maxDelay;
    }

    public void setMaxDelay(long maxDelay) {
        this.maxDelay = maxDelay;
    }

    public String getStorageUrl() {
        return storageUrl;
    }

    public String getStorageUsername() {
        return storageUsername;
    }

    public String getStoragePassword() {
        return storagePassword;
    }

    public void setStorageUrl(String storageUrl) {
        this.storageUrl = storageUrl;
    }

    public void setStorageUsername(String storageUsername) {
        this.storageUsername = storageUsername;
    }

    public void setStoragePassword(String storagePassword) {
        this.storagePassword = storagePassword;
    }

    public String getStorageBranch() {
        return storageBranch;
    }

    public void setStorageBranch(String storageBranch) {
        this.storageBranch = storageBranch;
    }

    public void setEnvs(String envs) {
        this.envs = envs;
    }

    private FilePath getFinalLocalPath() {
        String path = localPath.replace("${JENKINS_HOME}", Jenkins.get().root.getPath());
        return new FilePath(Jenkins.get().getRootPath().getChannel(), path);
    }

    public ConfigProject toConfigProject() {
        return new ConfigProject(projectRepositoryUrl, projectBranch, getFinalLocalPath(), maxDelay);
    }

    public StorageConfig toStorageConfig() {
        return new StorageConfig(storageUrl, storageUsername, storagePassword, storageBranch);
    }

    public ConfigProject getConfigProject() {
        return DeployGlobalConfiguration.get().toConfigProject();
    }

    public DeployConfig getDeployConfig() {
        return DeployConfig.getInstance(getConfigProject());
    }

    public StorageConfig getStorageConfig() {
        return DeployGlobalConfiguration.get().toStorageConfig();
    }

    public DeployService getDeployService() {
        return DeployService.getInstance(getConfigProject(), getStorageConfig());
    }

    public DeployInfoTable getInfoTable() {
        return getDeployService().getInfoTable();
    }

    public DeployModelTable getModelTable() {
        return getDeployService().getModelTable();
    }

    public String getEnvs() {
        return envs;
    }

    public List<String> getEnvList() {
        if (envs == null) {
            return Collections.emptyList();
        }

        String[] a = envs.split(",");
        List<String> list = new ArrayList<>(a.length);
        for (String s : a) {
            String ss = s.trim();
            if (ss.length() > 0) {
                list.add(ss);
            }
        }
        return list;
    }
}
