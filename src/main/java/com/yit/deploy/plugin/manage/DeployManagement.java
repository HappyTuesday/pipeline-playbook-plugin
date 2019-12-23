package com.yit.deploy.plugin.manage;

import com.yit.deploy.core.control.DeployService;
import com.yit.deploy.core.exceptions.DeployException;
import com.yit.deploy.core.info.DeployTableResponse;
import com.yit.deploy.core.records.Branch;
import com.yit.deploy.core.records.DeployRecordTable;
import com.yit.deploy.plugin.steps.DeployGlobalConfiguration;
import com.yit.deploy.plugin.util.ServeJson;
import hudson.Extension;
import hudson.Plugin;
import hudson.model.Action;
import hudson.model.ManagementLink;
import jenkins.model.Jenkins;
import org.kohsuke.stapler.StaplerRequest;
import org.kohsuke.stapler.StaplerResponse;

import javax.annotation.CheckForNull;
import javax.servlet.ServletException;
import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

@Extension
public class DeployManagement extends ManagementLink {

    private static final Logger LOGGER = Logger.getLogger(DeployManagement.class.getName());
    /**
     * Mostly works like {@link Action#getIconFileName()}, except that
     * the expected icon size is 48x48, not 24x24. So if you give
     * just a file name, "/images/48x48" will be assumed.
     *
     * @return As a special case, return null to exclude this object from the management link.
     * This is useful for defining {@link ManagementLink} that only shows up under
     * certain circumstances.
     */
    @CheckForNull
    @Override
    public String getIconFileName() {
        return "/plugin/playbook-pipeline/images/deploy.png";
    }

    /**
     * {@inheritDoc}
     *
     * <p>
     * In case of {@link ManagementLink}, this value is put straight into the href attribute,
     * so relative paths are interpreted against the root {@link Jenkins} object.
     */
    @CheckForNull
    @Override
    public String getUrlName() {
        return "playbook-pipeline-manage";
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
        return "Manage Playbook Pipeline";
    }

    private URL getStaticResourceURL(String resourceName) throws MalformedURLException {
        Plugin plugin = Jenkins.get().getPlugin("playbook-pipeline");
        if (plugin == null) {
            throw new IllegalArgumentException("could not find plugin playbook-pipeline");
        }

        return new URL(plugin.getWrapper().baseResourceURL, resourceName);
    }

    public void doIndex(StaplerRequest request, StaplerResponse response) throws ServletException, IOException {
        response.serveFile(request, getStaticResourceURL("playbook-pipeline-manage/index.html"));
    }

    public void doDynamic(StaplerRequest request, StaplerResponse response) throws ServletException, IOException {
        doIndex(request, response);
    }

    @ServeJson
    public List<Branch> doGetBranches() {
        try {
            DeployService service = DeployGlobalConfiguration.get().getDeployService();
            return service.getBranches();
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "failed to get branches", e);
            throw new DeployException(500, e.getMessage());
        }
    }

    @ServeJson
    public List<DeployRecordTable> doLoadCommits(StaplerRequest request) {
        try {
            DeployTableResponse.LoadCommitsForm form = DeployTableResponse.LoadCommitsForm.fromJson(request.getReader());
            DeployService service = DeployGlobalConfiguration.get().getDeployService();
            return service.loadCommits(form.getFrom(), form.getCount());
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "failed to load commits", e);
            throw new DeployException(500, e.getMessage());
        }
    }

    @ServeJson
    public DeployTableResponse doGetDeployTable(StaplerRequest request) throws IOException {
        try {
            DeployTableResponse.GetInfoTableForm form = DeployTableResponse.GetInfoTableForm.fromJson(request.getReader());
            DeployService service = DeployGlobalConfiguration.get().getDeployService();
            return service.getDeployTableResponse(form.getTargetBranch());
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "failed to get info table", e);
            throw new DeployException(500, e.getMessage());
        }
    }

    @ServeJson
    public DeployRecordTable.SubmitDraftResult doSaveDraft(StaplerRequest request) throws IOException {
        DeployRecordTable.SubmitDraftForm form = DeployRecordTable.SubmitDraftForm.fromJson(request.getReader());
        DeployRecordTable.SubmitDraftResult result = new DeployRecordTable.SubmitDraftResult();
        if (form == null || form.getDraft() == null) {
            result.setError("invalid draft form");
            return result;
        }
        if (form.getTargetBranch() == null) {
            result.setError("target branch is not set");
            return result;
        }
        DeployService service = DeployGlobalConfiguration.get().getDeployService();
        try {
            service.saveDraft(form.getTargetBranch(), form.getDraft());
            result.setCommit(form.getDraft().getCommit());
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "failed to save draft ", e);
            result.setError(e.getMessage());
        }
        return result;
    }
}
