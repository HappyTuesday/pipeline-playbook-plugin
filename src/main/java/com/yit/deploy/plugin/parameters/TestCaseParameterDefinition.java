package com.yit.deploy.plugin.parameters;

import com.yit.deploy.core.model.ProcessLauncher;
import hudson.Extension;
import hudson.FilePath;
import hudson.model.ParameterDefinition;
import hudson.model.ParameterValue;
import hudson.model.StringParameterValue;
import jenkins.model.Jenkins;
import net.sf.json.JSONObject;
import org.kohsuke.stapler.DataBoundConstructor;
import org.kohsuke.stapler.StaplerRequest;
import org.kohsuke.stapler.bind.JavaScriptMethod;

import javax.annotation.CheckForNull;
import javax.annotation.Nonnull;
import java.io.IOException;
import java.util.Date;
import java.util.Objects;

public class TestCaseParameterDefinition extends ParameterDefinition {

    private String testCasesJson;
    private String repositoryUrl;
    private String resultPath;
    private int cacheDurationInMinute;

    public int getCacheDurationInMinute() {
        return cacheDurationInMinute;
    }

    public void setCacheDurationInMinute(int cacheDurationInMinute) { this.cacheDurationInMinute = cacheDurationInMinute; }

    public String getRepositoryUrl() {
        return repositoryUrl;
    }

    public void setRepositoryUrl(String repositoryUrl) {
        this.repositoryUrl = repositoryUrl;
    }

    public String getResultPath() {
        return resultPath;
    }

    public void setResultPath(String resultPath) {
        this.resultPath = resultPath;
    }

    public String getTestCasesJson() {
        return testCasesJson;
    }

    public void setTestCasesJson(String testCasesJson) {
        this.testCasesJson = testCasesJson;
    }

    @DataBoundConstructor
    public TestCaseParameterDefinition(String name, String description, String repositoryUrl, String resultPath, int cacheDurationInMinute) {
        super(name, description);
        this.repositoryUrl = repositoryUrl;
        this.resultPath = resultPath;
        this.cacheDurationInMinute = cacheDurationInMinute;
    }

    @Override
    public ParameterValue createValue(StaplerRequest req, JSONObject jo) {
        String value = jo.getString("value");
        return new StringParameterValue(getName(), value);
    }

    @CheckForNull
    @Override
    public ParameterValue createValue(StaplerRequest req) {
        return null;
    }

    @Extension
    public static class DescriptorImpl extends ParameterDescriptor {
        @Nonnull
        @Override
        public String getDisplayName() {
            return "Test Case Parameter";
        }
    }

    private static final Object masterLock = new Object();
    private static final Object instanceLock = new Object();
    private static Object masterObj;
    private static String testCasesConfig = "";

    @JavaScriptMethod
    @SuppressWarnings("ST_WRITE_TO_STATIC_FROM_INSTANCE_METHOD")
    public String getTestCases() throws InterruptedException, IOException {
        boolean masterThread = false;
        String resultFileName = resultPath.replaceAll(".*/(.*)", "$1");

        FilePath rootPath = Jenkins.get().getRootPath().child("test-case-parameter");
        FilePath cachePath = rootPath.child(resultFileName);

        if (cachePath.exists()) {
            long lastModifiedTime = cachePath.lastModified();
            long currentTime = new Date().getTime();
            if ((currentTime - lastModifiedTime) < cacheDurationInMinute * 60 * 1000L) {
                return cachePath.readToString();
            }
        }

        synchronized (masterLock) {
            if (masterObj == null) {
                masterThread = true;
                masterObj = new Object();
            }
        }

        String result;
        if (masterThread) {
            synchronized (instanceLock) {
                testCasesConfig = "";
                if (!rootPath.exists()) {
                    rootPath.mkdirs();
                }
                FilePath tempPath = rootPath.createTempDir("temp", "");
                try {
                    new ProcessLauncher("git", "clone", repositoryUrl, tempPath.getName()).pwd(rootPath).executePrintOutput();
                    new ProcessLauncher("mvn", "test").pwd(tempPath).executePrintOutput();
                    FilePath jsonPath = tempPath.child(resultPath);
                    if (jsonPath.exists()) {
                        testCasesConfig = jsonPath.readToString();
                        if (cachePath.exists()) {
                            cachePath.delete();
                        }
                        jsonPath.copyToWithPermission(cachePath);
                        tempPath.deleteRecursive();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    synchronized (masterLock) {
                        masterObj = null;
                    }
                }
                result = testCasesConfig;
            }
        } else {
            synchronized (instanceLock) {
                result = testCasesConfig;
            }
        }

        return result;
    }
}
