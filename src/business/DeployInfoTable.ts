import {
    mapValues,
    mergeList,
    containsAll,
    contains,
    intersect,
    listEqualsIgnoreOrder, groupBy, copyDefinedProperties
} from "../functions/collection";
import {descending} from "../functions/inherits";
import {SimpleVariables} from "./Variables";
import {Closure} from "./Closure";
import {VariableInfo} from "./Variable";
import {SimpleIterator} from "../functions/iterator";
import {
    applyRecordsToMap,
    Assignment,
    AssignmentScope, Commit,
    DeployRecordTable,
    EnvironmentRecord,
    HostGroupRecord, HostRecord, ProjectRecord
} from "@/business/DeployRecordTable";
import {Environment, EnvironmentQuery, Play, Projects} from "@/business/DeployModelTable";

export class DeployInfoTable {

    readonly commit: Commit;
    envs: Map<string, EnvironmentInfo>;
    playbooks: Map<string, PlaybookInfo>;
    projects: Map<string, ProjectInfo>;

    constructor({commit = {}, envs = {}, playbooks = {}, projects = {}}) {
        this.commit = new Commit(<any>commit);
        this.envs = mapValues(envs, x => new EnvironmentInfo(<any>x));
        this.playbooks = mapValues(playbooks, x => new PlaybookInfo(<any>x));
        this.projects = mapValues(projects, x => new ProjectInfo(<any>x));
    }

    update(delta = {}): this {
        return Object.assign(new DeployInfoTable(<any>{}), this, delta);
    }

    withRecordTable(recordTable: DeployRecordTable): DeployInfoTable {
        let target = new DeployInfoTable({commit: recordTable.commit});

        target.envs = this.envs;
        if (recordTable.envs) {
            if (target.envs === this.envs) {
                target.envs = new Map(this.envs);
            }

            applyRecordsToMap(recordTable.envs, r => r.name, target.envs, r => new EnvironmentInfo(r));
        }

        if (recordTable.hosts) {
            if (target.envs === this.envs) {
                target.envs = new Map(this.envs);
            }

            for (let [name, records] of groupBy(recordTable.hosts, hg => hg.env)) {
                let env = target.envs.get(name);
                if (!env) {
                    throw new Error("could not find env " + name);
                }
                target.envs.set(name, env.withHostRecords(records));
            }
        }

        if (recordTable.hostGroups) {
            if (target.envs === this.envs) {
                target.envs = new Map(this.envs);
            }

            for (let [name, records] of groupBy(recordTable.hostGroups, h => h.env)) {
                let env = target.envs.get(name);
                if (!env) {
                    throw new Error("could not find env " + name);
                }
                target.envs.set(name, env.withHostGroupRecords(records));
            }
        }

        if (recordTable.assigns) {
            let assignsForEnv = groupBy(recordTable.assigns.filter(
                a => !a.scope || a.scope === AssignmentScope.environment),
                a => a.envName || Environment.ROOT_ENVIRONMENT_NAME
            );

            if (assignsForEnv.size > 0) {
                if (target.envs === this.envs) {
                    target.envs = new Map(this.envs);
                }

                for (let [name, records] of assignsForEnv) {
                    let env = target.envs.get(name);
                    if (!env) {
                        throw new Error("could not find env " + name);
                    }
                    target.envs.set(name, env.withAssignRecords(records));
                }
            }
        }

        target.playbooks = this.playbooks;

        target.projects = this.projects;

        if (recordTable.projects) {
            if (target.projects === this.projects) {
                target.projects = new Map(this.projects);
            }

            applyRecordsToMap(recordTable.projects, r => r.projectName, target.projects, r => new ProjectInfo(r));
        }

        if (recordTable.assigns) {
            let assignsForProjects = groupBy(recordTable.assigns.filter(
                a => a.scope === AssignmentScope.project),
                a => a.projectName || Projects.ROOT_PROJECT_NAME
            );

            if (assignsForProjects.size > 0) {
                if (target.projects === this.projects) {
                    target.projects = new Map(this.projects);
                }

                for (let [name, records] of assignsForProjects) {
                    let project = target.projects.get(name);
                    if (!project) {
                        throw new Error("could not find env " + name);
                    }
                    target.projects.set(name, project.withAssignRecords(records));
                }
            }
        }

        return target;
    }
}

export class EnvironmentInfo {

    readonly name: string;
    readonly id: string;
    abstracted: boolean;
    description: string;
    parents: string[];
    labels: string[];
    varInfos: VariableInfo[];
    vars: SimpleVariables;
    hosts: Map<string, HostInfo>;
    hostGroups: Map<string, HostGroupInfo>;

    constructor({name, id, abstracted, description, parents = [], labels = [], vars = [], hosts = [], hostGroups = []}) {
        this.name = name;
        this.id = id;
        this.abstracted = abstracted;
        this.description = description;
        this.parents = parents;
        this.labels = labels;
        this.varInfos = vars.map(x => new VariableInfo(x));
        this.vars = EnvironmentInfo.createVars(this.name, this.varInfos);
        this.hosts = mapValues(hosts, x => new HostInfo(<any>x));
        this.hostGroups = mapValues(hostGroups, x => new HostGroupInfo(<any>x));
    }

    private static createVars(name, varInfos: VariableInfo[]): SimpleVariables {
        return new SimpleVariables(varInfos, `env ${name}`);
    }

    clone(): this {
        return Object.assign(new EnvironmentInfo(<any>{}), this);
    }

    descending(infoMap: Map<string, EnvironmentInfo>): string[] {
        return descending(this.name, e => infoMap.get(e).parents);
    }

    withRecord(record: EnvironmentRecord): EnvironmentInfo {
        let t = this.clone();
        copyDefinedProperties(t, record);
        return t;
    }

    withHostRecords(records: HostRecord[]): EnvironmentInfo {
        let hosts = new Map(this.hosts);
        applyRecordsToMap(records, r => r.name, hosts, r => new HostInfo(r));
        let t = this.clone();
        t.hosts = hosts;
        return t;
    }

    withHostGroupRecords(records: HostGroupRecord[]): EnvironmentInfo {
        let hostGroups = new Map(this.hostGroups);
        applyRecordsToMap(records, r => r.name, hostGroups, r => new HostGroupInfo(r));
        let t = this.clone();
        t.hostGroups = hostGroups;
        return t;
    }

    withAssignRecords(records: Assignment[]): EnvironmentInfo {
        let varInfos = Array.from(this.varInfos);
        records.forEach(r => r.insertToVariableInfoList(varInfos));
        let t = this.clone();
        t.varInfos = varInfos;
        t.vars = EnvironmentInfo.createVars(t.name, t.varInfos);
        return t;
    }
}

export class HostInfo {

    name: string;
    id: string;
    user: string;
    port: number;
    channel: string;
    retired: boolean;
    labels: Map<string, any>;
    description: string;

    constructor({name, id, user, port, channel, retired, labels = {}, description}) {
        this.name = name;
        this.id = id;
        this.user = user;
        this.port = port;
        this.channel = channel;
        this.retired = retired;
        this.labels = mapValues(labels, v => v);
        this.description = description;
    }

    clone(): this {
        return Object.assign(new HostInfo(<any>{}), this);
    }

    /**
     * merge another host info into this one
     */
    merge(that: HostInfo): void {
        if (that.id) this.id = that.id;
        if (that.user) this.user = that.user;
        if (that.port) this.port = that.port;
        if (that.channel) this.channel = that.channel;
        if (that.retired) this.retired = that.retired;
        if (that.labels) {
            for (let [key, value] of that.labels) {
                this.labels.set(key, value);
            }
        }
        if (that.description) {
            this.description = that.description;
        }
    }

    withRecord(record: HostRecord): HostInfo {
        let t = this.clone();
        copyDefinedProperties(t, record);
        return t;
    }
}

export class HostGroupInfo {

    name: string;
    id: string;
    description: string;
    overrideHosts: boolean;
    hosts: string[];
    hostsRetired: string[];
    inherits: string[];
    inheritsRetired: string[];

    constructor({name, id, description, overrideHosts, hosts = [], hostsRetired = [], inherits = [], inheritsRetired = []}) {
        this.name = name;
        this.id = id;
        this.description = description;
        this.overrideHosts = overrideHosts;
        this.hosts = hosts;
        this.hostsRetired = hostsRetired;
        this.inherits = inherits;
        this.inheritsRetired = inheritsRetired;
    }

    clone(): this {
        return Object.assign(new HostGroupInfo(<any>{}), this);
    }

    /**
     * merge another host group info into this one
     */
    merge(that: HostGroupInfo): void {
        if (that.id !== null && that.id !== undefined) {
            this.id = that.id;
        }
        if (that.description !== null && that.description !== undefined) {
            this.description = that.description;
        }
        if (that.overrideHosts) {
            this.hosts = [];
            this.hostsRetired = [];
        }

        mergeList(this.hosts, that.hosts);
        mergeList(this.hostsRetired, that.hostsRetired);
        mergeList(this.inherits, that.inherits);
        mergeList(this.inheritsRetired, that.inheritsRetired);
    }

    withRecord(record: HostGroupRecord): HostGroupInfo {
        let t = this.clone();
        copyDefinedProperties(t, record);
        return t;
    }
}

export class PlaybookInfo {

    readonly name: string;
    readonly description: string;
    readonly parents: string[];
    readonly parameterSpecs: Map<string, PlaybookParameterSpec>;
    readonly activeInEnv: string;
    readonly vars: SimpleVariables;
    readonly plays: Map<string, PlayInfo>;
    readonly scenes: Map<string, PlaybookScene>;

    constructor({name, description, parents = [], parameterSpecs = {}, activeInEnv, vars = [], plays = {}, scenes = {}}) {
        this.name = name;
        this.description = description;
        this.parents = parents;
        this.parameterSpecs = mapValues(parameterSpecs, x => new PlaybookParameterSpec(<any>x));
        this.activeInEnv = activeInEnv;
        this.vars = new SimpleVariables(vars.map(x => new VariableInfo(x)), `playbook ${name}`);
        this.plays = mapValues(plays, x => new PlayInfo(<any>x));
        this.scenes = mapValues(scenes, x => new PlaybookScene(<any>x));
    }

    matchParameters(parameters: Map<string, any>): boolean {
        for (let spec of this.parameterSpecs.values()) {
            if (!spec.match(parameters)) {
                return false;
            }
        }
        return true;
    }

    descending(parameters: Map<string, any>, infoMap: Map<string, PlaybookInfo>): string[] {
        return descending(this.name, n => {
            let info = infoMap.get(n);
            if (!info) {
                throw new Error("could not find playbook with name " + n);
            }
            let i = 0;
            return new SimpleIterator(() => {
                while (true) {
                    if (i < info.parents.length) {
                        let p = info.parents[i++];
                        if (infoMap.get(p).matchParameters(parameters)) {
                            return p;
                        }
                    } else {
                        return undefined;
                    }
                }
            });
        });
    }

    static findSuperPlay(play: PlayInfo, playbookAscending: PlaybookInfo[]): PlayInfo {
        let playName = play.name;
        let found = false;
        for (let pb of playbookAscending) {
            let pi = pb.plays.get(playName);
            // p belongs to pb
            if (pi === play) {
                if (found) {
                    throw new Error("duplicated play found: " + playName);
                }
                found = true;
            } else if (found && pi) {
                return pi;
            }
        }
        return null;
    }

    static findPlay(playName: string, playbookAscending: PlaybookInfo[]): PlayInfo {
        for (let pb of playbookAscending) {
            let pi = pb.plays.get(playName);
            if (pi) {
                return pi;
            }
        }
        return null;
    }
}

export class PlaybookParameterSpec {

    readonly name: string;
    readonly allowedValues: any[];

    constructor({name, allowedValues}) {
        this.name = name;
        this.allowedValues = allowedValues;
    }

    intersect(that: PlaybookParameterSpec): PlaybookParameterSpec {
        if (this.name !== that.name) {
            throw new Error("only playbook parameter specs with the same name can be intersected");
        }
        let alv;
        if (!this.allowedValues) {
            alv = that.allowedValues;
        } else if (!that.allowedValues) {
            alv = this.allowedValues;
        } else {
            alv = intersect(this.allowedValues, that.allowedValues);
        }
        return new PlaybookParameterSpec({name: this.name, allowedValues: alv});
    }

    /**
     * if equals to another playbook parameter spec
     */
    equals(that: PlaybookParameterSpec): boolean {
        return this.name === that.name && listEqualsIgnoreOrder(this.allowedValues, that.allowedValues);
    }

    match(parameters: Map<string, any>): boolean {
        if (!parameters.has(this.name)) {
            return false;
        }
        if (!this.allowedValues) {
            return true;
        }

        let value = parameters.get(this.name);
        if (value instanceof PlaybookParameterSpec) {
            // all values allowed by the target parameters are allowed by us
            return value.allowedValues && value.allowedValues.length > 0 && containsAll(this.allowedValues, value.allowedValues);
        }
        return contains(this.allowedValues, parameters.get(this.name));
    }
}

export class PlaybookScene {

    readonly name: string;
    readonly plays: string[];
    readonly tasksToSkip: string[];

    constructor({name, plays = [], tasksToSkip = []}) {
        this.name = name;
        this.plays = plays;
        this.tasksToSkip = tasksToSkip;
    }
}

export class PlayInfo {

    readonly name: string;
    readonly description: string;
    readonly override: boolean;
    parents: string[];
    vars: SimpleVariables;
    tasks: TaskInfo[];
    serial: number;
    when: Closure;
    includedOnlyInEnv: string[];
    excludedInEnv: string[];
    retries: number;
    alwaysRun: boolean;
    resourcesRequired: string[];

    constructor({
                    name, description, override, parents = [], vars = [], tasks = [], serial,
                    when, includedOnlyInEnv, excludedInEnv, retries, alwaysRun, resourcesRequired = []
                }) {
        this.name = name;
        this.description = description;
        this.override = override;
        this.parents = parents;
        this.vars = new SimpleVariables(vars.map(x => new VariableInfo(x)), `play ${name}`);
        this.tasks = tasks.map(x => new TaskInfo(x));
        this.serial = serial;
        this.when = when ? new Closure(when) : null;
        this.includedOnlyInEnv = includedOnlyInEnv;
        this.excludedInEnv = excludedInEnv;
        this.retries = retries;
        this.alwaysRun = alwaysRun;
        this.resourcesRequired = resourcesRequired;
    }

    descending(playbookAscending: PlaybookInfo[]): PlayInfo[] {
        return descending(<PlayInfo>this, p => SimpleIterator.from(p.parents).map(s => {
            let pi: PlayInfo;
            if (Play.INHERITS_SUPER === s) {
                pi = PlaybookInfo.findSuperPlay(p, playbookAscending);
            } else {
                pi = PlaybookInfo.findPlay(s, playbookAscending);
            }
            if (!pi) {
                throw new Error("could not find play " + s);
            }
            return pi;
        }));
    }
}

export class TaskInfo {

    readonly path: string;
    readonly closure: Closure;
    readonly when: Closure[];
    readonly includedOnlyInEnv: string[];
    readonly excludedInEnv: string[];
    readonly retries: number;
    readonly tags: string[];
    readonly resourcesRequired: string[];
    readonly includeRetiredHosts: boolean;
    readonly onlyRetiredHosts: boolean;
    readonly reverse: boolean;

    constructor({
                    path, closure, when = [], includedOnlyInEnv, excludedInEnv, retries, tags = [],
                    resourcesRequired = [], includeRetiredHosts, onlyRetiredHosts, reverse
                }) {
        this.path = path;
        this.closure = closure ? new Closure(closure) : null;
        this.when = when.map(x => new Closure(x));
        this.includedOnlyInEnv = includedOnlyInEnv;
        this.excludedInEnv = excludedInEnv;
        this.retries = retries;
        this.tags = tags;
        this.resourcesRequired = resourcesRequired;
        this.includeRetiredHosts = includeRetiredHosts;
        this.onlyRetiredHosts = onlyRetiredHosts;
        this.reverse = reverse;
    }
}

export class ProjectInfo {

    readonly projectName: string;
    readonly projectNameGenerator: Closure;
    readonly variableGroupGenerator: Closure;
    readonly key: string;
    readonly id: string;
    readonly activeInEnv: string;
    readonly description: string;
    readonly parents: string[];
    readonly abstracted: boolean;
    varInfos: VariableInfo[];
    vars: SimpleVariables;
    overrides: ProjectOverrideInfo[];
    readonly playbookName: string;
    readonly when: Closure[];
    readonly includedInEnv: string[];
    readonly includedOnlyInEnv: string[];
    readonly excludedInEnv: string[];
    readonly sharing: Map<string, string>;

    constructor({
                    projectName, projectNameGenerator, variableGroupGenerator, key, id, activeInEnv, description,
                    parents = [], abstracted, vars = [], overrides = [],
                    playbookName, when = [], includedInEnv, includedOnlyInEnv, excludedInEnv, sharing
                }) {
        this.projectName = projectName;
        this.projectNameGenerator = projectNameGenerator ? new Closure(projectNameGenerator) : null;
        this.variableGroupGenerator = variableGroupGenerator ? new Closure(variableGroupGenerator) : null;
        this.key = key;
        this.id = id;
        this.activeInEnv = activeInEnv;
        this.description = description;
        this.parents = parents;
        this.abstracted = abstracted;
        this.varInfos = vars.map(x => new VariableInfo(x));
        this.vars = new SimpleVariables(this.varInfos, "project " + projectName);
        this.overrides = overrides.map(o => new ProjectOverrideInfo(projectName, o));
        this.playbookName = playbookName;
        this.when = when.map(x => new Closure(x));
        this.includedInEnv = includedInEnv;
        this.includedOnlyInEnv = includedOnlyInEnv;
        this.excludedInEnv = excludedInEnv;
        this.sharing = mapValues(sharing, x => <string>x);
    }

    clone(): this {
        return Object.assign(new ProjectInfo(<any>{}), this);
    }

    descending(infoMap: Map<string, ProjectInfo>): string[] {
        return descending(this.projectName, e => infoMap.get(e).parents);
    }

    withRecord(record: ProjectRecord): ProjectInfo {
        let t = this.clone();
        copyDefinedProperties(t, record);
        return t;
    }

    withAssignRecords(records: Assignment[]): ProjectInfo {
        let varInfos = this.varInfos.slice();

        let map = new Map<string, Assignment[]>();
        for (let record of records) {
            if (record.envName) {
                if (!map.get(record.envName)) {
                    map.set(record.envName, []);
                }
                map.get(record.envName).push(record);
            } else {
                record.insertToVariableInfoList(varInfos);
            }
        }

        let t = this.clone();
        t.varInfos = varInfos;
        t.vars = new SimpleVariables(varInfos, "project " + this.projectName);
        t.overrides = this.overrides.slice();

        for (let [name, rs] of map) {
            let query = new EnvironmentQuery(name);
            let index = t.overrides.findIndex(o => o.query.equals(query));
            let list;
            if (index < 0) {
                list = [];
            } else {
                list = t.overrides[index].varInfos.slice();
            }
            rs.forEach(r => r.insertToVariableInfoList(list));
            let override = new ProjectOverrideInfo(this.projectName, {query: {expr: name}, vars: list});

            if (index < 0) {
                t.overrides.push(override);
            } else {
                t.overrides[index] = override;
            }
        }

        return t;
    }
}

export class ProjectOverrideInfo {
    readonly query: EnvironmentQuery;
    readonly varInfos: VariableInfo[];
    readonly vars: SimpleVariables;

    constructor(projectName, {query, vars = []}) {
        this.query = query instanceof EnvironmentQuery ? query : new EnvironmentQuery(query.expr);
        this.varInfos = vars.map(x => new VariableInfo(x));
        this.vars = new SimpleVariables(this.varInfos, "project " + projectName + " in " + query.expr);
    }
}

export class ProjectPlaybookInfo {
    readonly playbookName: string;
    readonly playbookParams: Map<string, any>;
    readonly overrides: ProjectPlaybookOverrideInfo[];

    constructor({playbookName, playbookParams = {}, overrides = []}) {
        this.playbookName = playbookName;
        this.playbookParams = mapValues(playbookParams, x => x);
        this.overrides = overrides.map(o => new ProjectPlaybookOverrideInfo(o));
    }
}

export class ProjectPlaybookOverrideInfo {
    readonly query: EnvironmentQuery;
    readonly playbookParams: Map<string, any>;

    constructor({query: {expr}, playbookParams = {}}) {
        this.query = new EnvironmentQuery(expr);
        this.playbookParams = mapValues(playbookParams, x => x);
    }
}