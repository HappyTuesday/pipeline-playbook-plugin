package com.yit.deploy.plugin.parameters;

import hudson.Extension;
import hudson.model.ParameterDefinition;
import hudson.model.ParameterValue;
import hudson.model.StringParameterValue;
import net.sf.json.JSONObject;
import org.kohsuke.stapler.DataBoundConstructor;
import org.kohsuke.stapler.StaplerRequest;

public class HiddenParameterDefinition extends ParameterDefinition {

    private String defaultValue;

    @DataBoundConstructor
    public HiddenParameterDefinition(String name, String defaultValue, String description) {
        super(name, description);
        this.defaultValue = defaultValue;
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
    public StringParameterValue createValue(StaplerRequest req, JSONObject jo) {
        return new StringParameterValue(getName(), defaultValue, getDescription());
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
    public StringParameterValue createValue(StaplerRequest req) {
        return new StringParameterValue(getName(), defaultValue, getDescription());
    }

    public StringParameterValue createValue(Object obj) {
        return new StringParameterValue(getName(), obj == null ? null : obj.toString(), getDescription());
    }

    @Override
    public HiddenParameterDefinition copyWithDefaultValue(ParameterValue defaultValue) {
        return new HiddenParameterDefinition(getName(), (String)defaultValue.getValue(), getDescription());
    }

    @Override
    public StringParameterValue getDefaultParameterValue() {
        return new StringParameterValue(getName(), defaultValue, getDescription());
    }

    @Extension
    public static class DescriptorImpl extends ParameterDescriptor {
        @Override
        public String getDisplayName() {
            return "Hidden Parameter";
        }
    }

    public String getDefaultValue() {
        return defaultValue;
    }
}
