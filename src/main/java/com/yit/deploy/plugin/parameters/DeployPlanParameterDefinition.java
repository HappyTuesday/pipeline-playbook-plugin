package com.yit.deploy.plugin.parameters;

import com.google.common.base.Strings;
import com.yit.deploy.core.exceptions.DeployException;
import com.yit.deploy.core.function.Lambda;
import com.yit.deploy.core.model.DeployModelTable;
import com.yit.deploy.core.model.DeployResponse;
import com.yit.deploy.core.model.StatusCode;
import com.yit.deploy.core.parameters.inventory.*;
import com.yit.deploy.core.utils.Utils;
import com.yit.deploy.plugin.steps.DeployGlobalConfiguration;
import hudson.Extension;
import hudson.FilePath;
import hudson.model.ParameterDefinition;
import hudson.model.ParameterValue;
import hudson.model.User;
import jenkins.model.Jenkins;
import net.sf.json.JSONObject;
import org.kohsuke.stapler.DataBoundConstructor;
import org.kohsuke.stapler.StaplerRequest;
import org.kohsuke.stapler.bind.JavaScriptMethod;

import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;
import java.util.logging.Logger;

public class DeployPlanParameterDefinition extends ParameterDefinition implements DeployPlanService {

    private static final Logger LOGGER = Logger.getLogger(DeployPlanParameterDefinition.class.getName());

    private static final String READONLY_INVENTORY_NAME = "default";

    private String envName;
    private String defaultInventoryName;

    private String predefinedInventoryListJson;

    private String jobName;

    private transient DeployModelTable modelTable;
    private transient Environment _environment;

    private DataStorage dataStorage;

    @DataBoundConstructor
    public DeployPlanParameterDefinition(String name, String envName, String defaultInventoryName, String predefinedInventoryListJson, String jobName, String description) {
        super(name, description);
        this.defaultInventoryName = Lambda.isNullOrEmpty(defaultInventoryName) ? null : defaultInventoryName;
        this.predefinedInventoryListJson = predefinedInventoryListJson;
        this.jobName = jobName;
        this.envName = envName;
        this.dataStorage = new DataStorage(jobName, getName());
    }

    public synchronized Environment getEnvironment() {
        DeployModelTable modelTable = DeployGlobalConfiguration.get().getModelTable();
        if (this.modelTable == modelTable && this._environment != null) {
            return this._environment;
        }
        this._environment = new Environment(envName, modelTable.getJobs().getJobsInEnv(envName));
        this.modelTable = modelTable;
        return this._environment;
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
    public DeployInventoryParameterValue createValue(StaplerRequest req, JSONObject jo) {
        Environment env = getEnvironment();
        DeployInventory inventory = new DeployInventory().fromJson(jo.getString("value"));
        inventory.initialize(env);

        if (!Lambda.isNullOrEmpty(inventory.getSharedBy())) {
            disableSharing(inventory.getName());
        }

        if (inventory.getName().equals(getActiveInventoryName())) {
            clearActiveInventoryName();
        }

        dataStorage.saveLastDeployInventory(inventory);
        saveDeployInventorySnapshot(inventory);

        inventory.prepareForDeploy(env);
        return new DeployInventoryParameterValue(getName(), inventory, getDescription());
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
    public DeployInventoryParameterValue createValue(StaplerRequest req) {
        return getDefaultParameterValue();
    }

    @Override
    public DeployPlanParameterDefinition copyWithDefaultValue(ParameterValue defaultValue) {
        return new DeployPlanParameterDefinition(getName(), envName, getDefaultInventoryName(), predefinedInventoryListJson, jobName, getDescription());
    }

    @Override
    public DeployInventoryParameterValue getDefaultParameterValue() {
        DeployInventory inventory = getDefaultDeployInventory();
        inventory.prepareForDeploy(getEnvironment());
        return new DeployInventoryParameterValue(getName(), inventory, getDescription());
    }

    public DeployInventory getDefaultDeployInventory() {
        return getDeployInventory(getDefaultInventoryName());
    }

    private void saveDeployInventorySnapshot(DeployInventory inventory) {
        inventory = inventory.dump();
        DateFormat df = new SimpleDateFormat("yyyy-MM-dd HH:mm");
        String newInventoryName = "snapshot-" + df.format(new Date());
        inventory.setName(newInventoryName);
        inventory.setSharedBy(null); // disable sharing properties since we are just saving a snapshot
        dataStorage.saveDeployInventory(inventory);
    }

    @JavaScriptMethod
    public List<String> getSavedInventoryNames() {
        return dataStorage.listInventoryNames();
    }

    @JavaScriptMethod
    public DeployInventory httpGetDeployInventory(String inventoryName) {
        return getDeployInventory(inventoryName);
    }

    @JavaScriptMethod
    public DeployInventory httpPollDeployInventory(String inventoryName, long requestedVersion, long timeout) {
        long start = new Date().getTime();
        while (true) {
            DeployInventory inventory = getDeployInventory(inventoryName);
            if (inventory.getVersion() >= requestedVersion) return inventory;
            long left = timeout - (new Date().getTime() - start);
            if (left <= 0) return new DeployInventory();
            try {
                synchronized (this) {
                    wait(left < 1000 ? left : 1000);
                }
            } catch (InterruptedException e) {
                throw new IllegalStateException(e);
            }
        }
    }

    @JavaScriptMethod
    public DeployResponse<List<InventoryChange>> httpSaveDeployInventory(String inventoryJson, String changeId) {
        try {
            DeployInventory inventory = new DeployInventory().fromJson(inventoryJson);
            if (READONLY_INVENTORY_NAME.equals(inventory.getName())) {
                return new DeployResponse<>(new StatusCode(400, "cannot update readonly inventory " + READONLY_INVENTORY_NAME));
            }

            Environment environment = getEnvironment();
            inventory.initialize(environment);
            saveDeployInventory(inventory, changeId);

            return new DeployResponse<>(inventory.getChanges());
        } catch (DeployException e) {
            return new DeployResponse<>(e.getStatusCode());
        }
    }

    @JavaScriptMethod
    public void removeInventory(String inventoryName) {
        dataStorage.deleteDeployInventory(inventoryName);
    }

    @JavaScriptMethod
    public DeployInventory getLastInventory() {
        DeployInventory inventory = dataStorage.loadLastDeployInventory();
        if (inventory == null) inventory = new DeployInventory();
        inventory.initialize(getEnvironment());
        return inventory;
    }

    @JavaScriptMethod
    public DeployItem createSearchItem(String planJson, String searchScript) {
        DeployPlan plan = new DeployPlan().fromJson(planJson);
        Environment environment = getEnvironment();
        plan.initialize(environment);
        return plan.createSearchItem(environment, searchScript);
    }

    @JavaScriptMethod
    public DeployItem findDeployItem(String projectName, int planIndex, String inventoryName) {
        DeployInventory inventory = getDeployInventory(inventoryName);
        inventory.prepareForDeploy(getEnvironment());
        if (planIndex >= inventory.getPlans().size()) return null;
        return inventory.getPlans().get(planIndex).findItem(projectName);
    }

    @JavaScriptMethod
    public DeployItem findDeployItem(String projectName) {
        return findDeployItem(projectName, 0, getDefaultInventoryName());
    }

    @JavaScriptMethod
    public synchronized void updateDeployItem(String projectName, DeployItem deployItem, int planIndex, String inventoryName) {
        DeployInventory inventory = getDeployInventory(inventoryName);
        while (planIndex >= inventory.getPlans().size()) {
            DeployPlan plan = new DeployPlan();
            inventory.getPlans().add(plan);
        }
        DeployPlan plan = inventory.getPlans().get(planIndex);
        if (projectName == null) {
            throw new IllegalArgumentException("projectName");
        }
        deployItem.initialize(getEnvironment(), plan);
        boolean found = false;
        for (int i = 0; i < plan.getItems().size(); i++) {
            if (projectName.equals(plan.getItems().get(i).getProjectName())) {
                plan.getItems().set(i, deployItem);
                found = true;
                break;
            }
        }
        if (!found) {
            plan.getItems().add(deployItem);
        }
        saveDeployInventory(inventory);
    }

    @JavaScriptMethod
    public void updateDeployItem(String projectName, String deployItemJson, int planIndex, String inventoryName) {
        DeployItem item = new DeployItem().fromJson(deployItemJson);
        updateDeployItem(projectName, item, planIndex, inventoryName);
    }

    @JavaScriptMethod
    public void updateDeployItem(String projectName, String deployItemJson) {
        updateDeployItem(projectName, deployItemJson, 0, getDefaultInventoryName());
    }

    @JavaScriptMethod
    public void updateDeployItem(String projectName, DeployItem deployItem) {
        updateDeployItem(projectName, deployItem, 0, getDefaultInventoryName());
    }

    public String getActiveInventoryName() {
        return dataStorage.getActiveInventoryName();
    }

    public void setActiveInventoryName(String name) {
        dataStorage.setActiveInventoryName(name);
    }

    public void clearActiveInventoryName() {
        dataStorage.setActiveInventoryName(null);
    }

    public String getCurrentUserID() {
        User user = User.current();
        if (user == null) {
            return "Jenkins";
        }
        String name = user.getId();
        if ("SYSTEM".equals(name)) {
            return "Jenkins";
        }
        return name;
    }

    public DeployInventory getDeployInventory(String inventoryName) {
        Environment env = getEnvironment();
        DeployInventory inventory = dataStorage.loadDeployInventory(inventoryName);
        if (inventory == null) {
            inventory = getPredefinedInventory(inventoryName, env);
        } else {
            inventory.initialize(env);
        }
        return inventory;
    }

    private DeployInventory getPredefinedInventory(String inventoryName, Environment env) {
        DeployInventoryList list = getPredefinedInventoryList(env);

        for (DeployInventory inventory : list) {
            if(inventory.getName().equals(inventoryName)) {
                return inventory;
            }
        }

        DeployInventory inventory = new DeployInventory(inventoryName);
        inventory.initialize(env);
        return inventory;
    }

    public void saveDeployInventory(DeployInventory inventory) {
        saveDeployInventory(inventory, getDeployInventory(inventory.getName()));
    }

    public void saveDeployInventory(DeployInventory inventory, DeployInventory old) {
        saveDeployInventory(inventory, old, UUID.randomUUID().toString());
    }

    @Override
    public void initializeDeployInventory(DeployInventory inventory) {
        inventory.initialize(getEnvironment());
    }

    @Override
    public void prepareDeployInventoryForDeploy(DeployInventory inventory) {
        inventory.prepareForDeploy(getEnvironment());
    }

    public String getEnvironmentJson() {
        return getEnvironment().toJson();
    }

    public synchronized void saveDeployInventory(DeployInventory inventory, String changeId) {
        saveDeployInventory(inventory, getDeployInventory(inventory.getName()), changeId);
    }

    private synchronized void saveDeployInventory(DeployInventory inventory, DeployInventory old, String changeId) {

        String currentUser = getCurrentUserID();
        String oldSharedBy = Lambda.empty2null(old.getSharedBy());
        String newSharedBy = Lambda.empty2null(inventory.getSharedBy());

        if (!"Jenkins".equals(currentUser)) { // just ignore the calls from other pipeline jobs
            // begin sharing
            if (oldSharedBy == null && newSharedBy != null) {
                if (!newSharedBy.equals(currentUser)) {
                    throw new DeployException(413, "the shared-by " + newSharedBy + " is not match with " + currentUser);
                }
            }

            // end sharing
            if (oldSharedBy != null && newSharedBy == null) {
                if (!oldSharedBy.equals(currentUser)) {
                    throw new DeployException(413, "the sharing can only be ended by " + oldSharedBy);
                }
            }

            // change sharing owner
            if (oldSharedBy != null && newSharedBy != null && !oldSharedBy.equals(newSharedBy)) {
                // TODO: check if current user has an admin privilege to change the sharedBy field
                if (!newSharedBy.equals(currentUser)) {
                    throw new DeployException(413, "the sharing owner cannot be changed from " + oldSharedBy + " to " + newSharedBy + " by " + currentUser);
                }
            }
        }

        if (oldSharedBy == null && newSharedBy != null) { // start sharing
            if (getActiveInventoryName() == null) {
                setActiveInventoryName(inventory.getName());
            }
        } else if (oldSharedBy != null && newSharedBy == null) {
            if (inventory.getName().equals(getActiveInventoryName())) {
                clearActiveInventoryName();
            }
        }

        if (inventory.getVersion() != old.getVersion()) {
            throw new DeployException(410, "the specified version " + inventory.getVersion() + " is not match with stored version " + old.getVersion());
        }

        boolean changed = inventory.recordChange(old, currentUser, changeId);
        if (!changed) {
            return;
        }

        inventory.setUpdateDate(Utils.formatDate(new Date()));
        inventory.setVersion(old.getVersion() + 1);

        dataStorage.saveDeployInventory(inventory);
        LOGGER.info("deploy inventory " + inventory.getName() + " is saved with version " + inventory.getVersion());
        notifyAll();
    }

    public synchronized void disableSharing(String inventoryName) {
        DeployInventory inventory = dataStorage.loadDeployInventory(inventoryName);
        if (inventory == null) return;
        inventory.setSharedBy(null);
        saveDeployInventory(inventory);
    }

    public String getDefaultInventoryName() {
        return Lambda.cascade(dataStorage.getActiveInventoryName(), defaultInventoryName, "release-" + new SimpleDateFormat("yyyy-MM-dd-HH-mm").format(new Date()));
    }

    public DeployInventoryList getPredefinedInventoryList() {
        return getPredefinedInventoryList(getEnvironment());
    }

    public DeployInventoryList getPredefinedInventoryList(Environment env) {
        DeployInventoryList list;
        if (Strings.isNullOrEmpty(predefinedInventoryListJson)) {
            list = new DeployInventoryList();
        } else {
            list = DeployInventoryList.fromJson(predefinedInventoryListJson);
        }

        list.initialize(env);
        return list;
    }

    public String getPredefinedInventoryListJson() {
        return predefinedInventoryListJson;
    }

    public void setPredefinedInventoryListJson(String predefinedInventoryListJson) {
        this.predefinedInventoryListJson = predefinedInventoryListJson;
    }

    public String getJobName() {
        return jobName;
    }

    public void setJobName(String jobName) {
        this.jobName = jobName;
    }

    @Extension
    public static class DescriptorImpl extends ParameterDescriptor {
        @Override
        public String getDisplayName() {
            return "Deploy Plan Parameter";
        }
    }

    private static class DataStorage implements Serializable {
        private String jobName;
        private String parameterName;

        private static final String ACTIVE_INVENTORY_FILE_NAME = "HEAD";

        private DataStorage(String jobName, String parameterName) {
            this.jobName = jobName;
            this.parameterName = parameterName;
        }

        private String getActiveInventoryName() {
            try {
                FilePath path = getStorageRootPath().child(ACTIVE_INVENTORY_FILE_NAME);
                if (path.exists() && !path.isDirectory()) {
                    String name = path.readToString();
                    if (name != null && name.isEmpty()) name = null;
                    return name;
                }
                return null;
            } catch (IOException | InterruptedException e) {
                throw new IllegalStateException(e);
            }
        }

        private void setActiveInventoryName(String name) {
            try {
                FilePath path = getStorageRootPath().child(ACTIVE_INVENTORY_FILE_NAME);
                if (path.exists()) {
                    if (path.isDirectory()) {
                        path.deleteRecursive();
                    }
                }
                if (name == null || name.isEmpty()) {
                    path.delete();
                } else {
                    path.write(name, Utils.DefaultCharset.name());
                }
            } catch (IOException | InterruptedException e) {
                throw new RuntimeException(e);
            }
        }

        private DeployInventory loadLastDeployInventory() {
            return loadDeployInventory("", "last");
        }

        private void saveLastDeployInventory(DeployInventory value) {
            saveDeployInventory(value, "last");
        }

        private List<String> listInventoryNames() {
            FilePath rootPath = getStorageRootPath();
            try {
                List<FilePath> files = rootPath.list();
                files.sort((o1, o2) -> {
                    try {
                        return Long.compare(o2.lastModified(), o1.lastModified());
                    } catch (IOException | InterruptedException e) {
                        throw new RuntimeException(e);
                    }
                });
                List<String> names = new ArrayList<>();
                for (FilePath file : files) {
                    if(file.getName().endsWith(".json")) {
                        names.add(file.getBaseName());
                    }
                }
                return names;
            } catch (Exception e) {
                LOGGER.warning("list deploy inventories error: " + e);
                throw new RuntimeException(e);
            }
        }

        private void deleteDeployInventory(String inventoryName) {
            try {
                FilePath path = getStoragePath(inventoryName);
                if (path.exists()) {
                    path.delete();
                }
            } catch (Exception e) {
                LOGGER.warning("delete deploy inventory " + inventoryName + " error: " + e);
                if (e instanceof RuntimeException) {
                    throw (RuntimeException) e;
                }
                throw new RuntimeException(e);
            }
        }

        private DeployInventory loadDeployInventory(String inventoryName) {
            return loadDeployInventory(inventoryName, inventoryName);
        }

        private DeployInventory loadDeployInventory(String inventoryName, String fileBaseName) {
            try {
                FilePath path = getStoragePath(fileBaseName);
                if (path.exists()) {
                    String json = path.readToString();
                    return new DeployInventory().fromJson(json);
                }
            } catch (Exception e) {
                LOGGER.warning("load deploy inventory error: " + e);
            }

            return null;
        }

        private void saveDeployInventory(DeployInventory inventory) {
            saveDeployInventory(inventory, inventory.getName());
        }

        private void saveDeployInventory(DeployInventory inventory, String fileBaseName) {
            String json = inventory.toJson();
            try {
                FilePath path = getStoragePath(fileBaseName);
                path.write(json, "UTF-8");
            } catch (Exception e) {
                LOGGER.warning("save deploy inventory error: " + e);
                throw new RuntimeException(e);
            }
        }

        private FilePath getStoragePath(String inventoryName) {
            return getStorageRootPath().child(inventoryName + ".json");
        }

        private FilePath getStorageRootPath() {
            FilePath root = Jenkins.get().getRootPath().child(getStorageRootPathString());
            try {
                if (!root.exists()) {
                    root.mkdirs();
                }
                return root;
            } catch (RuntimeException e) {
                throw e;
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        private String getStorageRootPathString() {
            return "deploy-plan-parameter/storage/" + jobName + "/parameters/" + parameterName + "/inventories";
        }
    }
}
