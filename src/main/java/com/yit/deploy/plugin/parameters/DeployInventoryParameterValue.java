package com.yit.deploy.plugin.parameters;

import com.yit.deploy.core.parameters.inventory.DeployInventory;
import hudson.EnvVars;
import hudson.model.ParameterValue;
import hudson.model.Run;

public class DeployInventoryParameterValue extends ParameterValue {

    private DeployInventory deployInventory;

    protected DeployInventoryParameterValue(String name, DeployInventory deployInventory, String description) {
        super(name, description);
        this.deployInventory = deployInventory;
    }

    @Override
    public DeployInventory getValue() {
        return deployInventory;
    }

    @Override
    public void buildEnvironment(Run<?, ?> build, EnvVars env) {
        // env.put(name, deployInventory.toJson());
    }
}
