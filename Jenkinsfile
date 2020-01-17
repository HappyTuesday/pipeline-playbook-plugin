import groovy.json.*
import jenkins.model.*
import hudson.model.*
import hudson.*

import com.cloudbees.groovy.cps.NonCPS
import hudson.model.UpdateCenter
import hudson.model.UpdateSite
import net.sf.json.JSONArray
import net.sf.json.JSONObject
import org.apache.commons.io.FilenameUtils

import java.util.jar.JarFile
import jenkins.model.Jenkins
import org.apache.commons.lang.StringUtils

@NonCPS
boolean disablePlugin(String pluginName) {
    def wrapper = Jenkins.instance.pluginManager.getPlugin(pluginName)
    if (wrapper != null && wrapper.enabled) {
        println "disable plugin $pluginName"
        wrapper.disable()
        return true
    }
    return false
}

boolean disablePlugins(List<String> pluginNames) {
    boolean changed = false
    for (String n in pluginNames) {
        changed |= disablePlugin(n)
    }
    return changed
}

@NonCPS
boolean installPluginFromLocalFile(String fileName) {
    def file = new File(fileName)
    def pluginName
    def version = null
    def dependencies = new JSONArray()
    def j = new JarFile(file)
    try {
        def m = j.getManifest(), ma = m.getMainAttributes()
        pluginName = ma.getValue("Short-Name")
        if (pluginName == null) {
            pluginName = FilenameUtils.getBaseName(file.getName())
        }
        version = ma.getValue("Plugin-Version")
        def deps = ma.getValue("Plugin-Dependencies")

        if (deps != null && !deps.empty) {
            def plugins = deps.tokenize(',')
            for (def p in plugins) {
                def attrs = p.split("[:;]")
                dependencies.add(new JSONObject().element("name", attrs[0]).element("version", attrs[1]).element("optional", p.contains("resolution:=optional")))
            }
        }
    } finally {
        j.close()
    }

    def cfg = new JSONObject().element("name", pluginName).element("version", "0").element("url", file.toURI().toString()).element("dependencies", dependencies)
    def updateSite = new UpdateSite(UpdateCenter.ID_UPLOAD, null)
    def plugin = new UpdateSite.Plugin(updateSite, UpdateCenter.ID_UPLOAD, cfg)
    def task = null
    def wrapper = plugin.installed
    if (wrapper == null) {
        println "install plugin $pluginName with version $version"
        task = plugin.deploy(true)
    } else {
        if (wrapper.version != version) {
            println "upgrade plugin $pluginName from version $wrapper.version to $version"
            task = plugin.deploy(true)
        }
    }
    if (task != null) {
        task.get()
        return true
    }
    return false
}

node ("master") {
    checkout scm

    stage ("compile plugin and install plugin") {
        sh "./mvnw -DskipTests=true package"
        def changed = installPluginFromLocalFile "$env.WORKSPACE/target/pipeline-playbook.hpi"
        changed |= disablePlugins([
            "project-branch-parameter-plugin",
            "hidden-parameter-plugin",
            "deploy-plan-parameter-plugin",
            "groovy-cps-extension-plugin",
            "deploy-plugin",
            "playbook-pipeline"
         ])
        if (changed) {
            while (true) {
                int builds = Jenkins.instance.computers.sum {it.countBusy()}
                if (builds == 1) {
                    break
                } else {
                    echo "Wait for Jenkins to go to idle so that we can restart it. Currently there are/is $builds build[s] running now."
                    sleep 5
                }
            }
            Jenkins.instance.safeRestart()
        }
    }
}
