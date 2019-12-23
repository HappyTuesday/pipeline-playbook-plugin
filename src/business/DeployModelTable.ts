import {
    cascade,
    collectList,
    collectMap,
    collectUniqueList, countIf,
    findIndexOf,
    mapValues,
    mergeMap, unique
} from "../functions/collection";
import {travelDescending} from "../functions/inherits"
import {LayeredVariables, SimpleVariables} from "./Variables";
import {Graph} from "../functions/graph";
import {
    DeployInfoTable,
    EnvironmentInfo,
    HostGroupInfo,
    HostInfo,
    PlaybookInfo,
    PlaybookParameterSpec, PlaybookScene,
    PlayInfo, ProjectInfo, ProjectPlaybookInfo, TaskInfo
} from "./DeployInfoTable";
import {SimpleIterator} from "@/functions/iterator";
import {Closure} from "@/business/Closure";
import {Commit} from "@/business/DeployRecordTable";
import * as QueryExpression from "@/functions/QueryExpression";

export class DeployModelTable {

    readonly commit: Commit;
    readonly infoTable: DeployInfoTable;
    readonly projectPlaybooks: Map<string, ProjectPlaybookInfo>;
    private _envs: Environments;
    private _playbooks: Playbooks;
    private _projects: Projects;

    /**
     * create deploy model table from deploy info table plus optional draft
     */
    constructor(infoTable: DeployInfoTable, projectPlaybooks: Map<string, ProjectPlaybookInfo>) {
        this.commit = infoTable.commit;
        this.infoTable = infoTable;
        this.projectPlaybooks = projectPlaybooks;
    }

    update(delta = {}): this {
        return Object.assign(new DeployModelTable(<any>{}, <any>{}), this, delta);
    }

    get envs(): Environments {
        if (!this._envs) {
            this._envs = new Environments(this.infoTable.envs);
        }
        return this._envs;
    }

    get playbooks(): Playbooks {
        if (!this._playbooks) {
            this._playbooks = new Playbooks(this.infoTable.playbooks, this.envs)
        }
        return this._playbooks;
    }

    get projects(): Projects {
        if (!this._projects) {
            this._projects = new Projects(this.infoTable.projects, this.envs, this.projectPlaybooks, this.playbooks);
        }
        return this._projects;
    }
}

export class Environments {

    private readonly map: Map<string, Environment>;

    constructor(infoMap: Map<string, EnvironmentInfo>) {
        this.map = new Map();

        let convert = (name) => {
            for (let p of infoMap.get(name).parents) {
                if (!this.map.has(p)) {
                    convert(p);
                }
            }

            this.map.set(name, new Environment(name, infoMap, this))
        };

        for (let key of infoMap.keys()) {
            if (!this.map.has(key)) {
                convert(key);
            }
        }
    }

    get(name: string): Environment {
        let e = this.map.get(name);
        if (!e) throw new Error("could not find environment " + name);
        return e;
    }

    getsByKey(key: string): Environment[] {
        let list = [];
        for (let e of this.map.values()) {
            if (e.match(key)) {
                // all envs inheriting e will be replaced by e
                list = list.filter(x => x.belongsTo(e));
                list.push(e);
            }
        }

        if (list.length === 0) {
            throw new Error("could not find environment " + key);
        }

        return list;
    }

    getRoot(): Environment {
        return this.map.get(Environment.ROOT_ENVIRONMENT_NAME);
    }

    getTotalEnvsCount(): number {
        return this.map.size;
    }

    getConcreteEnvsCount(): number {
        return countIf(this.map.values(), x => !x.abstracted);
    }

    values(): SimpleIterator<Environment> {
        return SimpleIterator.from(this.map.values());
    }

    /**
     * search the environments
     */
    search({searchKey, abstractMode}): Environment[] {
        let list = [];
        for (let env of this.map.values()) {
            if (searchKey) {
                if (env.name.indexOf(searchKey) < 0) {
                    continue;
                }
            }
            if (abstractMode && abstractMode !== "all") {
                if (abstractMode === "abstracted" && !env.abstracted || abstractMode === "concrete" && env.abstracted) {
                    continue;
                }
            }
            list.push(env);
        }
        return list.sort((x, y) => {
            return x.name < y.name ? -1 : x.name > y.name ? 1 : 0;
        });
    }
}

export class Environment {

    static ROOT_ENVIRONMENT_NAME = "shared.defaults";
    static DEFAULT_DEPLOY_USER_VARIABLE = "$DEFAULT_DEPLOY_USER";
    static HOSTS_QUERY_PATTERN = /^[&!]/;

    static readonly LOCAL_ENV_LABEL = "local";
    static readonly TEST_ENV_LABEL = "testenv";
    static readonly PROD_ENV_LABEL = "prod";

    readonly info: EnvironmentInfo;
    readonly name: string;
    readonly id: string;
    readonly abstracted: boolean;
    readonly description: string;
    readonly descending: Environment[];
    readonly ascendingParents: Environment[];
    readonly parents: Environment[];
    readonly vars: LayeredVariables;
    readonly cascadeVars: LayeredVariables;
    readonly labels: string[];
    readonly defaultDeployUser;
    readonly hosts: Hosts;
    readonly hostGroups: HostGroups;

    /**
     * create environment model
     */
    constructor(name: string, infoMap: Map<string, EnvironmentInfo>, envs: Environments) {
        let info = infoMap.get(name);

        this.info = info;

        this.name = info.name;
        this.id = info.id;
        this.abstracted = !!info.abstracted;
        this.description = info.description;

        let descending = info.descending(infoMap).map(x => infoMap.get(x));
        this.descending = descending.map(x => x === info ? this : envs.get(x.name));
        this.ascendingParents = this.descending.slice().reverse().slice(1);
        this.parents = info.parents.map(x => envs.get(x));

        this.vars = new LayeredVariables(`env ${name}`);
        for (let e of descending) {
            if (!e.vars.isEmpty()) {
                this.vars.addLayer(e.vars);
            }
        }
        this.vars.setWritableLayer(info.vars);
        this.cascadeVars = this.vars;
        this.labels = collectUniqueList(descending, x => x.labels);
        this.hosts = new Hosts(collectMap(descending, x => x.hosts), this);

        let hostGroups = new Map();
        for (let e of descending) {
            mergeMap(hostGroups, e.hostGroups, x => new HostGroupInfo(<any>{name: x}));
        }
        this.hostGroups = new HostGroups(hostGroups, this.hosts);
    }

    get localhost(): Host {
        return this.getHost("localhost");
    }

    findHost(hostname: string, retired: boolean = false): Host {
        let h = this.hosts.get(hostname);
        if (h && h.retired !== retired) {
            h = null;
        }
        return h;
    }

    getHost(hostname: string, retired: boolean = false): Host {
        let host = this.findHost(hostname, retired);
        if (!host) {
            throw new Error("could not find host " + hostname);
        }
        return host;
    }

    findHostGroup(hostGroupName: string): HostGroup {
        return this.hostGroups.get(hostGroupName);
    }

    getHostGroup(hostGroupName: string): HostGroup {
        let hg = this.findHostGroup(hostGroupName);
        if (!hg) {
            throw new Error("could not find host group " + hostGroupName);
        }
        return hg;
    }

    queryHosts(query: string): Host[] {
        return this.queryAllHosts(query).filter(h => !h.retired);
    }

    queryAllHosts(query: string): Host[] {

        let expr = QueryExpression.parse(query);
        let list = [];

        for (let hg of this.hostGroups.values()) {
            if (expr.match(hg.name)) {
                list.push(...hg.hosts);
            }
        }

        for (let h of this.hosts.values()) {
            if (expr.match(h.name)) {
                list.push(h.name);
            }
        }

        return unique(list);
    }

    filterHostsByLabels(labelsToMatch: Map<string, any> | string[]): Host[] {
        return this.hosts.filterByLabels(labelsToMatch);
    }

    getGroupServers(groupName: string): string[] {
        let hs = this.getHostGroup(groupName).hosts;
        let servers = [];
        for (let h of hs) {
            if (!h.retired) {
                servers.push(h.name);
            }
        }
        return servers;
    }

    isIncludedIn(including: string[] | string, excluding: string[] = undefined): boolean {
        if (excluding) {
            return this.isIncludedIn(including) && !this.isIncludedIn(excluding);
        }

        if (typeof including === "string") {
            return new EnvironmentQuery(including).match(this);
        }

        if (including == null) {
            return true;
        }

        for (let key of including) {
            if (this.isIncludedIn(key)) {
                return true;
            }
        }

        return false;
    }

    get envtype(): string {
        if (this.prodEnv) {
            return "prod";
        }
        if (this.testEnv) {
            return "testenv";
        }
        return "local";
    }

    get localEnv(): boolean {
        return this.labels.includes(Environment.LOCAL_ENV_LABEL);
    }

    get testEnv(): boolean {
        return this.labels.includes(Environment.TEST_ENV_LABEL);
    }

    get prodEnv(): boolean {
        return this.labels.includes(Environment.PROD_ENV_LABEL);
    }

    get rootEnv(): boolean {
        return Environment.ROOT_ENVIRONMENT_NAME === this.name;
    }

    belongsTo(another: Environment | string): boolean {
        if (another === null) {
            return true;
        }
        let anotherName = another instanceof Environment ? another.name : another;
        return this.descending.some(e => e.name === anotherName);
    }

    match(key: string): boolean {
        return key === null
            || key === undefined
            || key === "all"
            || this.name === key
            || this.labels.includes(key)
            || this.belongsTo(key);
    }
}

export class EnvironmentQuery {
    readonly expr: QueryExpression.Node;

    constructor(query: string | QueryExpression.Node) {
        this.expr = query instanceof QueryExpression.Node ? query : QueryExpression.parse(query);
    }

    match(env: Environment): boolean {
        return this.expr.match(env.name, key => env.match(key));
    }

    includes(another: EnvironmentQuery, envs: Environments): boolean {
        return this.expr.includes(another.expr, (key, target) => {
            let bigger = envs.getsByKey(key);
            let smaller = envs.getsByKey(target);
            return smaller.every(x => bigger.some(y => x.belongsTo(y)));
        });
    }

    toString() {
        return this.expr.toString();
    }

    equals(other: EnvironmentQuery) {
        return other && this.expr.equals(other.expr);
    }
}

export class HostGroups {

    private readonly map: Map<string, HostGroup>;

    /**
     *
     * @param {Map<string, HostGroupInfo>} infoMap
     * @param {Hosts} hosts
     * @return {Map<string, HostGroup>}
     */
    constructor(infoMap, hosts) {
        this.map = new Map();

        /**
         * @param {HostGroupInfo} info
         */
        let convert = info => {
            for (let hgi of info.inherits) {
                if (!this.map.has(hgi)) {
                    convert(infoMap.get(hgi));
                }
            }
            for (let hgi of info.inheritsRetired) {
                if (!this.map.has(hgi)) {
                    convert(infoMap.get(hgi));
                }
            }
            let hg = new HostGroup(info, this, hosts);
            this.map.set(hg.name, hg);
        };

        for (let info of infoMap.values()) {
            if (!this.map.has(info.name)) {
                convert(info);
            }
        }

        // initialize host group graph
        let graph = new Graph<HostGroup, string>();
        for (let hg of this.map.values()) {
            graph.node(hg.name, hg);
        }
        for (let hg of this.map.values()) {
            for (let p of hg.inherits) {
                graph.arc(p.name, hg.name, HostGroupInheritType.inherit);
            }
        }

        for (let hg of this.map.values()) {
            hg.initialize(graph);
        }
    }

    names(): IterableIterator<string> {
        return this.map.keys();
    }

    get(name: string): HostGroup {
        let hg = this.map.get(name);
        if (!hg) {
            throw new Error("could not find host-group " + name);
        }
        return hg;
    }

    values(): SimpleIterator<HostGroup> {
        return SimpleIterator.from(this.map.values());
    }

    size(): number {
        return this.map.size;
    }

    search({searchKey}): HostGroup[] {
        if (!searchKey) {
            return Array.from(this.map.values());
        }
        let ls = [];
        let lowered = searchKey.toLowerCase();
        for (let hg of this.map.values()) {
            if (hg.name.toLowerCase().includes(lowered)) {
                ls.push(hg);
            }
        }
        return ls;
    }
}

export class HostGroup {

    readonly info: HostGroupInfo;
    readonly name: string;
    readonly id: string;
    readonly selfHosts: Host[];
    readonly inherits: HostGroup[];
    readonly inheritsRetired: HostGroup[];

    inclusiveHosts: Host[]; // only be updated in initialize
    exclusiveHosts: Host[]; // only be updated in initialize
    hosts: Host[];

    /**
     * @param {HostGroupInfo} info
     * @param {HostGroups} hostGroups
     * @param {Hosts} hosts
     */
    constructor(info: HostGroupInfo, hostGroups: HostGroups, hosts: Hosts) {
        this.info = info;
        this.name = info.name;
        this.id = info.id;
        this.selfHosts = info.hosts.map(x => hosts.get(x));

        for (let name of info.hostsRetired) {
            let found = false;
            for (let i = 0; i < this.selfHosts.length; i++) {
                let h = this.selfHosts[i];
                if (h.name === name) {
                    if (!h.retired) {
                        this.selfHosts[i] = h.toRetired(true);
                    }
                    found = true;
                }
            }
            if (!found) {
                this.selfHosts.push(hosts.get(name).toRetired(true));
            }
        }

        this.inherits = info.inherits.map(x => hostGroups.get(x));
        this.inheritsRetired = info.inheritsRetired.map(x => hostGroups.get(x));
    }

    initialize(g: Graph<HostGroup, string>): void {
        this.hosts = this.getExclusiveHosts(g);
    }

    getInclusiveHosts(): Host[] {
        if (this.inclusiveHosts != null) {
            return this.inclusiveHosts;
        }

        let index = new Map();
        let list = [];

        let insert = h => {
            let i = index.get(h.name);
            if (i === undefined) {
                index.set(h.name, list.length);
                list.push(h);
            } else {
                list[i] = h;
            }
        };

        for (let hg of this.inherits) {
            hg.getInclusiveHosts().forEach(insert);
        }
        for (let hg of this.inheritsRetired) {
            hg.getInclusiveHosts().forEach(h => insert(h.toRetired(true)));
        }
        this.selfHosts.forEach(insert);

        this.inclusiveHosts = list;
        return list;
    }

    getExclusiveHosts(g: Graph<HostGroup, string>): Host[] {
        if (this.exclusiveHosts != null) {
            return this.exclusiveHosts;
        }

        let list = [];
        let index = new Map();
        let insert = h => {
            let i = index.get(h.name);
            if (i === undefined) {
                index.set(h.name, list.length);
                list.push(h);
            } else {
                list[i] = h.toRetired(list[i].retired && h.retired);
            }
        };

        this.getInclusiveHosts().forEach(insert);

        for (let nextName of g.next(this.name)) {
            g.getAt(nextName).getExclusiveHosts(g).forEach(insert);
        }

        this.exclusiveHosts = list;
        return this.exclusiveHosts;
    }
}

export class Hosts {

    private readonly map: Map<string, Host>;

    constructor(infoMap: Map<string, HostInfo>, env: Environment) {
        this.map = new Map();
        for (let info of infoMap.values()) {
            this.map.set(info.name, new Host(info, env));
        }
    }

    names(): IterableIterator<string> {
        return this.map.keys();
    }

    get(name: string): Host {
        let h = this.map.get(name);
        if (!h) {
            throw new Error("invalid host " + name);
        }
        return h;
    }

    size(): number {
        return this.map.size;
    }

    values(): SimpleIterator<Host> {
        return SimpleIterator.from(this.map.values());
    }

    search({searchKey}): Host[] {
        if (!searchKey) {
            return Array.from(this.map.values());
        }
        let ls = [];
        let lowered = searchKey.toLowerCase();
        for (let h of this.map.values()) {
            if (h.name.toLowerCase().includes(lowered)) {
                ls.push(h);
            }
        }
        return ls;
    }

    filterByLabels(labelsToMatch: Map<string, any> | string[]): Host[] {
        if (labelsToMatch instanceof Map) {
            let list = [];
            for (let h of this.map.values()) {
                let matched = true;
                for (let [name, value] of labelsToMatch) {
                    if (!Hosts.compareLabelValue(value, h.labels.get(name))) {
                        matched = false;
                        break;
                    }
                }
                if (matched) {
                    list.push(h);
                }
            }
            return list;
        }

        if (labelsToMatch instanceof Array) {
            let list = [];
            for (let h of this.map.values()) {
                let matched = true;
                for (let name of labelsToMatch) {
                    if (!h.labels.has(name)) {
                        matched = false;
                        break;
                    }
                }
                if (matched) {
                    list.push(h);
                }
            }
            return list;
        }

        throw new Error("invalid argument " + labelsToMatch);
    }

    static compareLabelValue(x: any, y: any): boolean {
        if (x === y) {
            return true;
        }

        if (x === y) {
            return true;
        }

        if ((x === null || x === undefined) && (y === null || y === undefined)) {
            return true;
        }

        if ((x === null || x === undefined) || (y === null || y === undefined)) {
            return false;
        }

        if (typeof x.equals === "function" && x.equals(y)) {
            return true;
        }

        if (typeof x[Symbol.iterator] === "function" && typeof y[Symbol.iterator] === "function") {
            if (x instanceof Array && y instanceof Array && x.length !== y.length) {
                return false;
            }

            let xi = x[Symbol.iterator](), yi = y[Symbol.iterator]();

            while (true) {
                let {value: xv, done: xd} = xi.next();
                let {value: yv, done: yd} = yi.next();

                if (xd && yd) {
                    break
                } else if (xd || yd) {
                    return false
                } else if (!Hosts.compareLabelValue(xv, yv)) {
                    return false;
                }
            }

            return true;
        }

        if (x instanceof Map && y instanceof Map) {
            if (x.size !== y.size) {
                return false;
            }

            for (let [key, value] of x) {
                if (!Hosts.compareLabelValue(value, y.get(key))) {
                    return false
                }
            }

            return true;
        }

        return false;
    }
}

export class Host {

    readonly info: HostInfo;
    readonly name: string;
    readonly id: string;
    readonly user: string;
    readonly port: number;
    readonly channel: string;
    retired: boolean;
    readonly labels: Map<string, any>;
    readonly description: string;

    constructor(info: HostInfo | Host, env: Environment = undefined) {
        if (info instanceof Host) {
            Object.assign(this, info);
        } else {
            this.info = info;
            this.name = info.name || env.defaultDeployUser;
            this.id = info.id;
            this.user = info.user;
            this.port = info.port || 22;
            this.channel = info.channel || "ssh";
            this.retired = info.retired;
            this.labels = info.labels;
            this.description = info.description;
        }
    }

    toRetired(retired: boolean): Host {
        if (retired === this.retired) {
            return this;
        }
        let h = new Host(this);
        h.retired = retired;
        return h;
    }
}

const HostGroupInheritType = {
    inherit: "inherit",
    retiredInherit: "retiredInherit"
};

export class Playbooks {

    readonly map: Map<string, PlaybookGroup>;
    readonly infoMap: Map<string, PlaybookInfo>;

    constructor(infoMap: Map<string, PlaybookInfo>, envs: Environments) {
        this.infoMap = infoMap;
        this.map = new Map();
        for (let info of infoMap.values()) {
            this.map.set(info.name, new PlaybookGroup(info, infoMap, envs));
        }
    }

    /**
     * get the playbook group
     */
    getGroup(name: string): PlaybookGroup {
        let g = this.map.get(name);
        if (!g) {
            throw new Error("invalid playbook group " + name);
        }
        return g;
    }

    getOrCreate(name: string, parameters: Map<string, any>): Playbook {
        if (name == null) {
            throw new Error("name must not be null");
        }

        let group = this.map.get(name);
        if (group == null) {
            throw new Error("invalid playbook name " + name);
        }

        return group.getOrCreate(parameters);
    }

    search({searchKey}): PlaybookGroup[] {
        let list = [];
        for (let group of this.map.values()) {
            if (!searchKey || group.name.includes(searchKey)) {
                list.push(group);
            }
        }
        return list.sort((x, y) => {
            return x.name < y.name ? -1 : x.name > y.name ? 1 : 0;
        });
    }
}

export class PlaybookGroup {

    readonly info: PlaybookInfo;
    readonly infoMap: Map<string, PlaybookInfo>;
    readonly envs: Environments;
    readonly name: string;
    readonly parameterSpecs: Map<string, {playbooks: Playbook[], spec: PlaybookParameterSpec}[]>;
    readonly defaults: Playbook;
    readonly list: Playbook[];

    constructor(info, infoMap, envs) {
        this.info = info;
        this.infoMap = infoMap;
        this.envs = envs;
        this.name = info.name;
        /**
         * @type {Map<string, {playbooks: [], spec: PlaybookParameterSpec}[]>}
         */
        this.parameterSpecs = new Map();
        travelDescending(info.name, p => infoMap.get(p).parents, p => {
            for (let spec of infoMap.get(p).parameterSpecs.values()) {
                if (!this.parameterSpecs.has(spec.name)) {
                    this.parameterSpecs.set(spec.name, []);
                }
                let list = this.parameterSpecs.get(spec.name);
                let pps = list.find(s => s.spec.equals(spec));
                if (pps) {
                    pps.playbooks.push(p);
                } else {
                    list.push({playbooks: [p], spec: spec});
                }
            }
        });
        this.defaults = new Playbook(info, info.parameterSpecs, infoMap, this, envs);
        this.list = [this.defaults];
    }

    getOrCreate(parameters: Map<string, any>): Playbook {
        for (let p of this.list) {
            let mismatch = false;
            // find the first playbook which matches all the parameters provided
            for (let name of parameters.keys()) {
                if (this.parameterSpecs.has(name)) {
                    // if a valid parameter is not included in this playbook, it must not be the one we want
                    if (!p.parameterSpecs.has(name) || !p.matchParameters(parameters)) {
                        mismatch = true;
                        break;
                    }
                }
            }
            if (!mismatch) {
                return p;
            }
        }

        let playbook = new Playbook(this.info, parameters, this.infoMap, this, this.envs);
        this.list.push(playbook);
        return playbook;
    }
}

export class Playbook {
    static DEFAULT_SCENE_NAME = "default";

    readonly info: PlaybookInfo;
    readonly infoMap: Map<string, PlaybookInfo>;
    readonly name: string;
    readonly description: string;
    readonly infoAscendingParents: PlaybookInfo[];
    readonly parameterSpecs: Map<string, PlaybookParameterSpec>;
    readonly activeInEnv: Environment;
    readonly plays: Map<string, Play>;
    readonly vars: LayeredVariables;
    readonly cascadeVars: LayeredVariables;
    readonly scenes: Map<string, PlaybookScene>;

    constructor(info: PlaybookInfo, parameters: Map<string, any>, infoMap: Map<string, PlaybookInfo>, playbookGroup: PlaybookGroup, envs: Environments) {
        this.info = info;
        this.infoMap = infoMap;
        if (!info.name) {
            throw new Error("playbook name is not set");
        }
        this.name = info.name;
        this.description = info.description;

        let infoDescending = info.descending(parameters, infoMap).map(x => infoMap.get(x));
        let infoAscending = infoDescending.slice().reverse();
        this.infoAscendingParents = infoAscending.slice(1);

        this.parameterSpecs = new Map();
        for (let p of infoDescending) {
            for (let spec of p.parameterSpecs.values()) {
                let target = this.parameterSpecs.get(spec.name);
                if (target == null) {
                    target = spec;
                } else {
                    target = target.intersect(spec);
                }
                this.parameterSpecs.set(spec.name, target);
            }
        }

        this.activeInEnv = envs.get(cascade(infoAscending, x => x.activeInEnv) || Environment.ROOT_ENVIRONMENT_NAME);

        this.vars = new LayeredVariables(`playbook ${this.name}`);
        for (let p of infoDescending) {
            if (!p.vars.isEmpty()) {
                this.vars.addLayer(p.vars);
            }
        }
        this.vars.setWritableLayer(info.vars);

        this.cascadeVars = new LayeredVariables(
            "cascade playbook " + this.name,
            [this.activeInEnv.vars, this.vars]
        );
        this.cascadeVars.setWritableLayer(info.vars);


        let playInfos = new Map();
        for (let p of infoDescending) {
            for (let [name, pi] of p.plays) {
                playInfos.set(name, pi);
            }
        }

        this.plays = mapValues(playInfos, pi => new Play(pi, infoAscending, this));

        this.scenes = new Map();
        for (let p of infoDescending) {
            for (let scene of p.scenes.values()) {
                this.scenes.set(scene.name, scene);
            }
        }
    }

    getDefaultScene(): PlaybookScene {
        return this.scenes.get(Playbook.DEFAULT_SCENE_NAME);
    }

    matchParameters(parameters: Map<string, any>): boolean {
        for (let spec of this.parameterSpecs.values()) {
            if (!spec.match(parameters)) {
                return false;
            }
        }
        return true;
    }

    isEnabledIn(env: Environment): boolean {
        return env.belongsTo(this.activeInEnv);
    }
}

export class Play {

    static readonly SEARCH_VARIABLE = "$PLAY_SEARCH";
    static readonly INHERITS_SUPER = "@super";

    readonly info: PlayInfo;
    readonly name: string;
    readonly description: string;
    readonly tasks: TaskList;
    readonly vars: LayeredVariables;
    readonly cascadeVars: LayeredVariables;
    readonly serial: number;
    readonly when: Closure;
    readonly includedOnlyInEnv: string[];
    readonly excludedInEnv: string[];
    readonly retries: number;
    readonly alwaysRun: boolean;
    readonly resourcesRequired: string[];

    constructor(info: PlayInfo, playbookAscending: PlaybookInfo[], playbook: Playbook) {
        this.info = info;
        this.name = info.name;
        this.description = info.description;

        let infoDescending = info.descending(playbookAscending);
        let infoAscending = infoDescending.slice().reverse();

        this.tasks = new TaskList(collectList(infoDescending, x => x.tasks));

        this.vars = new LayeredVariables(`play ${this.name}`);
        for (let p of infoDescending) {
            this.vars.addLayer(p.vars);
        }
        this.vars.setWritableLayer(info.vars);
        this.cascadeVars = new LayeredVariables(
            "cascade play " + this.name,
            [playbook.activeInEnv.vars, playbook.vars, this.vars]
        );

        this.serial = cascade(infoAscending, x => x.serial) || 0.0;
        this.when = cascade(infoAscending, x => x.when);
        this.includedOnlyInEnv = cascade(infoAscending, x => x.includedOnlyInEnv);
        this.excludedInEnv = cascade(infoAscending, x => x.excludedInEnv);
        this.retries = cascade(infoAscending, x => x.retries) || 0;
        this.alwaysRun = cascade(infoAscending, x => x.alwaysRun) || false;

        this.resourcesRequired = collectList(infoDescending, x => x.resourcesRequired);
    }
}

export class TaskList {

    readonly list: Task[];

    constructor(infos: TaskInfo[] = []) {
        this.list = [];
        for (let info of infos) {
            this.insertTask(info.path, info);
        }
    }

    insertTask(path: string, info: TaskInfo): void {
        let i = path.indexOf(Task.PATH_SPLITTER);
        if (i >= 0) {
            let name = path.substring(0, i);
            let task = this.list.find(t => name === t.name);
            if (task == null) {
                throw new Error("could not find parent task " + name + " for task path " + path);
            }
            task.children.insertTask(path.substring(i + 1), info);
            return;
        }

        // path is a real task name
        let j = findIndexOf(this.list, t => path === t.name);
        let task = new Task(path, info);
        if (j < 0) {
            this.list.push(task);
        } else {
            this.list[j] = task;
        }
    }

    search(): Task[] {
        return this.list;
    }

    get empty(): boolean {
        if (this.list.length === 0) {
            return true;
        }
        for (let t of this.list) {
            if (!t.empty) {
                return false
            }
        }
        return true;
    }
}

export class Task {

    static PATH_SPLITTER = '/';

    readonly info: TaskInfo;
    readonly name: string;
    readonly closure: Closure;
    readonly children: TaskList;
    readonly when: Closure[];
    readonly includedOnlyInEnv: string[];
    readonly excludedInEnv: string[];
    readonly retries: number;
    readonly tags: string[];
    readonly resourcesRequired: string[];
    readonly includeRetiredHosts: boolean;
    readonly onlyRetiredHosts: boolean;
    readonly reverse: boolean;

    constructor(name: string, info: TaskInfo) {
        this.info = info;
        this.name = name;
        this.closure = info.closure;
        this.children = new TaskList();
        this.when = info.when;
        this.includedOnlyInEnv = info.includedOnlyInEnv;
        this.excludedInEnv = info.excludedInEnv;
        this.retries = info.retries;
        this.tags = info.tags;
        this.resourcesRequired = info.resourcesRequired;
        this.includeRetiredHosts = info.includeRetiredHosts;
        this.onlyRetiredHosts = info.onlyRetiredHosts;
        this.reverse = info.reverse;
    }

    get empty(): boolean {
        return !this.closure && this.children.empty;
    }
}

export class Projects {
    static ROOT_PROJECT_NAME: string = "$";

    private readonly map: Map<string, Project>;

    constructor(infoMap: Map<string, ProjectInfo>,
                envs: Environments,
                projectPlaybooks: Map<string, ProjectPlaybookInfo>,
                playbooks: Playbooks) {

        this.map = new Map();

        let convert = (projectName) => {
            for (let p of infoMap.get(projectName).parents) {
                if (!this.map.has(p)) {
                    convert(p);
                }
            }

            this.map.set(projectName, new Project(projectName, infoMap, this, envs, projectPlaybooks, playbooks))
        };

        for (let key of infoMap.keys()) {
            if (!this.map.has(key)) {
                convert(key);
            }
        }
    }

    get(projectName: string): Project {
        let p = this.map.get(projectName);
        if (!p) throw new Error("could not find project " + projectName);
        return p;
    }

    values(): SimpleIterator<Project> {
        return SimpleIterator.from(this.map.values());
    }

    /**
     * search projects
     */
    search({searchKey, abstractMode}): Project[] {
        let list = [];

        for (let project of this.map.values()) {
            if (searchKey) {
                if (project.projectName.indexOf(searchKey) < 0) {
                    continue;
                }
            }
            if (abstractMode && abstractMode !== "all") {
                if (abstractMode === "abstracted" && !project.abstracted || abstractMode === "concrete" && project.abstracted) {
                    continue;
                }
            }
            list.push(project);
        }
        return list.sort((x, y) => {
            return x.projectName < y.projectName ? -1 : x.projectName > y.projectName ? 1 : 0;
        });
    }
}

export class Project {
    static readonly VARIABLE_GROUP_SEPARATOR = '_';

    static readonly JOB_NAME_VARIABLE = "$PROJECT_JOB_NAME";
    static readonly PLAYBOOK_PARAMETERS_VARIABLE = "$PLAYBOOK_PARAMETERS";
    static readonly GROUP_NAME_VARIABLE = "$PROJECT_GROUP_NAME";
    static readonly SECTION_NAME_VARIABLE = "$PROJECT_SECTION_NAME";
    static readonly JOB_ORDER_VARIABLE = "$PROJECT_JOB_ORDER";
    static readonly CONTAINER_LABELS_VARIABLE = "$PROJECT_CONTAINER_LABELS";
    static readonly PROJECT_GIT_NAME_VARIABLE = "$PROJECT_GIT_NAME";
    static readonly GIT_REPOSITORY_URL_VARIABLE = "$GIT_REPOSITORY_URL";
    static readonly DEFAULT_BRANCH_VARIABLE = "$PROJECT_DEFAULT_BRANCH";
    static readonly DEPENDENCY_VARIABLE = "$PROJECT_DEPENDENCY";
    static readonly SCHEDULE_VARIABLE = "$PROJECT_SCHEDULE";
    static readonly TASKS_TO_SKIP_VARIABLE = "$PROJECT_TASKS_TO_SKIP";
    static readonly REQUIRED_TASKS_VARIABLE = "$REQUIRED_TASKS";

    readonly info: ProjectInfo;
    readonly projectName: string;
    readonly variableGroupGenerator: Closure;
    readonly key: string;
    readonly id: string;
    readonly abstracted: boolean;
    readonly description: string;
    readonly descending: Project[];
    readonly parents: Project[];
    readonly activeInEnv: Environment;
    readonly projectNameGenerator: Closure;
    readonly vars: SimpleVariables;
    readonly cascadeVars: LayeredVariables;
    readonly overrides: ProjectOverride[];
    readonly playbooks: Playbooks;
    readonly playbookName: string;
    readonly playbookParams: Map<string, any>;
    readonly playbook: Playbook;
    readonly envs: Environments;
    readonly projects: Projects;
    readonly when: Closure[];
    readonly includedOnlyInEnv: string[];
    readonly includedInEnv: string[];
    readonly excludedInEnv: string[];
    readonly sharing: Map<string, string>;

    constructor(projectName: string,
                infoMap: Map<string, ProjectInfo>,
                projects: Projects,
                envs: Environments,
                projectPlaybooks: Map<string, ProjectPlaybookInfo>,
                playbooks: Playbooks) {

        let info = infoMap.get(projectName);
        if (!info) {
            throw new Error("invalid project " + projectName);
        }
        this.info = info;

        this.projectName = info.projectName;
        this.key = info.key;
        this.id = info.id;
        this.abstracted = !!info.abstracted; // avoid undefined

        let descending = info.descending(infoMap).map(x => infoMap.get(x));
        this.descending = descending.map(x => x === info ? this : projects.get(x.projectName));
        this.parents = info.parents.map(x => projects.get(x));
        let ascending = descending.slice().reverse();

        this.activeInEnv = envs.get(cascade(ascending, x => x.activeInEnv));
        this.description = info.description;
        this.projectNameGenerator = cascade(ascending, x => x.projectNameGenerator);
        this.playbookName = cascade(ascending, x => x.playbookName);
        this.playbooks = playbooks;
        let projectPlaybook = projectPlaybooks.get(projectName);
        if (projectPlaybook) {
            this.playbookParams = projectPlaybook.playbookParams;
        }
        this.envs = envs;
        this.projects = projects;
        this.when = cascade(ascending, x => x.when);
        this.includedOnlyInEnv = info.includedOnlyInEnv;
        this.includedInEnv = info.includedInEnv;
        this.excludedInEnv = info.excludedInEnv;
        this.vars = info.vars;

        if (this.playbookName && this.playbookParams) {
            this.playbook = playbooks.getOrCreate(this.playbookName, this.playbookParams);
        }

        let queries: EnvironmentQuery[] = [];
        for (let p of descending) {
            for (let o of p.overrides) {
                if (!queries.find(q => q.equals(o.query))) {
                    queries.push(o.query);
                }
            }
        }

        this.overrides = queries.map(q => new ProjectOverride(q, this, projectPlaybook, playbooks));


        this.cascadeVars = new LayeredVariables("cascade project " + this.projectName);
        this.cascadeVars.addLayer(this.activeInEnv.vars);
        if (this.playbook) {
            this.cascadeVars.addLayer(this.playbook.vars);
        }
        for (let p of descending) {
            this.cascadeVars.addLayer(p.vars);
        }
        this.cascadeVars.setWritableLayer(this.vars);

        this.variableGroupGenerator = cascade(ascending, x => x.variableGroupGenerator);

        this.sharing = new Map();

        let inheritedSharing = [];
        for (let p of descending) {
            if (p.sharing && p.sharing.size > 0) {
                inheritedSharing.push(p.sharing);
            }
        }

        if (inheritedSharing.length > 0) {
            for (let env of envs.values()) {
                if (env.abstracted) continue;

                let target = null;
                for (let m of inheritedSharing) {
                    for (let [key, value] of m) {
                        if (env.isIncludedIn(key)) {
                            target = value;
                        }
                    }
                }

                if (target && target !== env.name) {
                    let targetEnv = envs.get(target);
                    if (targetEnv.abstracted) {
                        throw new Error("env " + target + " is not abstracted, " +
                            "only non-abstracted env can be shared.");
                    }
                    this.sharing.set(env.name, target);
                }
            }
        }
    }

    isEnabledInEnv(env: Environment): boolean {
        if (!env.belongsTo(this.activeInEnv)) {
            return false;
        }
        let excluded = false;
        for (let p of this.descending) {
            if (p.includedInEnv && env.isIncludedIn(p.includedInEnv)) {
                excluded = false;
            }
            if (p.includedOnlyInEnv) {
                if (env.isIncludedIn(p.includedOnlyInEnv)) {
                    excluded = false;
                } else {
                    return false;
                }
            }
            if (p.excludedInEnv && env.isIncludedIn(p.excludedInEnv)) {
                excluded = true;
            }
        }

        return !excluded;
    }

    getVarsForEnv(env: Environment | EnvironmentQuery): LayeredVariables {
        let name = env instanceof Environment ? env.name : env.expr;
        let layers = new LayeredVariables(`cascade project ${this.projectName}` + (env ? ` in env ${name}` : ''));
        for (let p of this.descending) {
            layers.addLayer(p.getDeclaredVarsForEnv(env));
        }
        return layers;
    }

    getDeclaredVarsForEnv(env: Environment | EnvironmentQuery): LayeredVariables {
        let name = env instanceof Environment ? env.name : env.expr;
        let layers = new LayeredVariables(`project ${this.projectName}` + (env ? ` in env ${name}` : ''));

        if (!this.vars.isEmpty()) {
            layers.addLayer(this.vars);
        }

        if (env instanceof Environment) {

            let list = this.info.overrides.filter(o => o.query.match(env));

            for (let e of env.descending) {
                for (let i = 0; i < list.length; i++) {
                    let o = list[i];
                    if (o.query.match(e)) {
                        list.splice(i, 1);
                        if (!o.vars.isEmpty()) {
                            layers.addLayer(o.vars);
                        }
                    }
                }
            }
        } else {
            for (let override of this.info.overrides) {
                if (override.query.includes(env, this.envs)) {
                    layers.addLayer(override.vars);
                }
            }
        }

        return layers;
    }

    belongsTo(parent: Project | string): boolean {
        if (parent === null) {
            return true;
        }
        let name = parent instanceof Project ? parent.projectName : parent;
        return this.descending.some(p => p.projectName === name);
    }

    get rootProject(): boolean {
        return this.projectName === Projects.ROOT_PROJECT_NAME;
    }
}

export class ProjectOverride {

    readonly title: string;
    readonly query: EnvironmentQuery;
    readonly project: Project;
    readonly playbookParams: Map<string, any>;
    readonly playbook: Playbook;
    readonly vars: LayeredVariables;
    readonly cascadeVars: LayeredVariables;
    readonly inherited: boolean;

    /**
     * create a project override instance
     */
    constructor(query: EnvironmentQuery, project: Project, projectPlaybook: ProjectPlaybookInfo, playbooks: Playbooks) {
        this.title = query.toString();
        this.query = query;
        this.project = project;
        if (projectPlaybook) {
            let projectPlaybookOverride = projectPlaybook.overrides.find(ppo => ppo.query.equals(query));
            if (projectPlaybookOverride) {
                this.playbookParams = projectPlaybookOverride.playbookParams;
            }
        }
        if (project.playbookName && this.playbookParams) {
            this.playbook = playbooks.getOrCreate(project.playbookName, this.playbookParams);
        }

        this.cascadeVars = new LayeredVariables("cascade project " + this.project.projectName);
        this.cascadeVars.addLayer(this.project.activeInEnv.vars);
        if (this.playbook) {
            this.cascadeVars.addLayer(this.playbook.vars);
        }
        this.vars = this.project.getVarsForEnv(this.query);
        this.cascadeVars.addLayer(this.vars);
        let poi = project.info.overrides.find(o => o.query.equals(query));
        if (poi) {
            this.cascadeVars.setWritableLayer(poi.vars);
            this.vars.setWritableLayer(poi.vars);
            this.inherited = false;
        } else {
            this.inherited = true;
        }
    }
}