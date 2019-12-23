package com.yit.deploy.plugin.parameters;

import com.yit.deploy.core.parameters.inventory.DeployItem;
import hudson.Extension;
import hudson.model.*;
import jenkins.model.Jenkins;
import net.sf.json.JSONObject;
import org.kohsuke.stapler.DataBoundConstructor;
import org.kohsuke.stapler.DataBoundSetter;
import org.kohsuke.stapler.StaplerRequest;
import org.kohsuke.stapler.bind.JavaScriptMethod;

import javax.annotation.Nonnull;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Created by nick on 20/10/2017.
 */
public class ProjectBranchParameterDefinition extends ParameterDefinition {

    private static final Logger LOGGER = Logger.getLogger(ProjectBranchParameterDefinition.class.getName());

    private static final String deployInventoryParameterName = "deployInventory";
    private static final String projectBranchKeyName = "project_branch";

    private String defaultValue;
    private String projectName;
    private boolean readonly;
    private String targetSyncJobName;

    @DataBoundConstructor
    public ProjectBranchParameterDefinition(String name, String defaultValue, String description, String projectName, String targetSyncJobName) {
        super(name, description);
        this.defaultValue = defaultValue;
        this.projectName = projectName;
        this.targetSyncJobName = targetSyncJobName;
    }

    /**
     * Create a parameter value from a form submission.
     * <p>
     * <p>
     * This method is invoked when the user fills in the parameter values in the HTML form
     * and submits it to the server.
     *
     * @param req
     * @param jo
     */
    @Override
    public ParameterValue createValue(StaplerRequest req, JSONObject jo) {
        Object value = jo.get("value");
        String valueString = value != null ? value.toString() : defaultValue;
        return new StringParameterValue(getName(), valueString, getDescription());
    }

    /**
     * Create a parameter value from a GET with query string.
     * If no value is available in the request, it returns a default value if possible, or null.
     * <p>
     * <p>
     * Unlike {@link #createValue(StaplerRequest, JSONObject)}, this method is intended to support
     * the programmatic POST-ing of the build URL. This form is less expressive (as it doesn't support
     * the tree form), but it's more scriptable.
     * <p>
     * <p>
     * If a {@link ParameterDefinition} can't really support this mode of creating a value,
     * you may just always return null.
     *
     * @param req
     * @throws IllegalStateException If the parameter is deemed required but was missing in the submission.
     */
    @Override
    public ParameterValue createValue(StaplerRequest req) {
        String[] value = req.getParameterValues(getName());
        if (value == null) {
            return getDefaultParameterValue();
        } else if (value.length != 1) {
            throw new IllegalArgumentException("Illegal number of parameter values for " + getName() + ": " + value.length);
        } else {
            return createValue(value[0]);
        }
    }

    public StringParameterValue createValue(Object obj) {
        return new StringParameterValue(getName(), obj == null ? null : obj.toString(), getDescription());
    }

    @Override
    public ProjectBranchParameterDefinition copyWithDefaultValue(ParameterValue defaultValue) {
        ProjectBranchParameterDefinition that = new ProjectBranchParameterDefinition(getName(), (String)defaultValue.getValue(), getDescription(), projectName, targetSyncJobName);
        that.setReadonly(this.readonly);
        return that;
    }

    @Override
    public StringParameterValue getDefaultParameterValue() {
        return new StringParameterValue(getName(), defaultValue, getDescription());
    }

    public String getProjectName() {
        return projectName;
    }

    public String getTargetSyncJobName() {
        return targetSyncJobName;
    }

    public String getDefaultValue() {
        return defaultValue;
    }

    public boolean isReadonly() {
        return readonly;
    }

    @DataBoundSetter
    public void setReadonly(boolean readonly) {
        this.readonly = readonly;
    }

    @JavaScriptMethod
    public Map<String, String> getFinalDefaultValue() {
        try {
            String value = getDefaultValueFromSyncJob();
            return Collections.singletonMap("value", value != null ? value : defaultValue);
        } catch (Exception e) {
            return Collections.singletonMap("error", e.getMessage());
        }
    }

    public DeployItem getTargetDeployItem() {
        DeployPlanParameterDefinition pd = getDeployPlanParameterDefinition();
        if (pd == null) return null;
        DeployItem item = pd.findDeployItem(projectName);
        if (item == null || item.getParameters() == null) return null;
        return item;
    }

    private String getDefaultValueFromSyncJob() {
        DeployItem item = getTargetDeployItem();
        if (item == null) return null;
        return (String) item.getParameters().get(projectBranchKeyName);
    }

    @JavaScriptMethod
    public String saveValueToSyncJob(String value) {
        try {
            DeployPlanParameterDefinition pd = getDeployPlanParameterDefinition();
            if (pd == null) return "could not find deploy plan parameter definition";
            DeployItem item = pd.findDeployItem(projectName);
            if (item == null) {
                item = new DeployItem();
                item.setProjectName(projectName);
            }
            if (item.getParameters() == null) {
                item.setParameters(new HashMap<>());
            }
            item.setTags(null);
            item.setSkipTags(null);
            item.setServers(null);
            item.getParameters().put(projectBranchKeyName, value);
            pd.updateDeployItem(projectName, item);
            return null;
        } catch (Exception e) {
            return e.getMessage();
        }
    }

    private DeployPlanParameterDefinition getDeployPlanParameterDefinition() {
        Job job = (Job) Jenkins.get().getItem(targetSyncJobName);
        if (job == null) return null;
        ParametersDefinitionProperty pp = (ParametersDefinitionProperty) job.getProperty(ParametersDefinitionProperty.class);
        return (DeployPlanParameterDefinition) pp.getParameterDefinition(deployInventoryParameterName);
    }

    @Extension
    public static class DescriptorImpl extends ParameterDescriptor {
        @Nonnull
        @Override
        public String getDisplayName() {
            return "Project Branch Parameter";
        }
    }
}
