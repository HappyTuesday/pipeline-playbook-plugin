import {VariableInfo} from "@/business/Variable";
import {copyDefinedProperties} from "@/functions/collection";

export class Branch {
    readonly name: string;
    readonly head: number;

    constructor({name, head = undefined}) {
        this.name = name;
        this.head = head;
    }
}

export class Commit {
    readonly id: number;
    readonly author: string;
    readonly comment: string;
    readonly timestamp: Date;
    readonly parentId: number;

    constructor({id, author, timestamp, parentId, comment}) {
        this.id = id;
        this.author = author;
        this.comment = comment;
        this.timestamp = timestamp;
        this.parentId = parentId;
    }
}

export class DeployRecords {
    private readonly map: Map<number, DeployRecordTable>;

    constructor(that: DeployRecords = undefined) {
        if (that) {
            this.map = new Map(that.map);
        } else {
            this.map = new Map();
        }
    }

    get(id: number): DeployRecordTable {
        return this.map.get(id);
    }

    append(data: any[]): DeployRecords {
        let that = new DeployRecords(this);
        for (let r of data) {
            that.map.set(r.commit.id, new DeployRecordTable(r));
        }
        return that;
    }
}

export class DeployRecordTable {

    commit: Commit;
    envs: EnvironmentRecord[];
    projects: ProjectRecord[];
    assigns: Assignment[];
    hosts: HostRecord[];
    hostGroups: HostGroupRecord[];

    constructor({commit = undefined, envs = [], projects = [], assigns = [], hosts = [], hostGroups = []} = {}) {
        this.commit = commit ? new Commit(commit) : undefined;
        this.envs = envs.map(e => new EnvironmentRecord(e));
        this.projects = projects.map(p => new ProjectRecord(p));
        this.assigns = assigns.map(a => new Assignment(a));
        this.hosts = hosts.map(h => new HostRecord(h));
        this.hostGroups = hostGroups.map(hg => new HostGroupRecord(hg));
    }

    clone(): this {
        return Object.assign(new DeployRecordTable(), this);
    }

    private add<T>(tableName: string, record: T, finder: (r1: T, r2) => boolean): DeployRecordTable {
        let t = this.clone();

        let list = <T[]> t[tableName];
        list = list ? Array.from(list) : [];
        t[tableName] = list;

        let index = list.findIndex(r => finder(r, record));
        if (index < 0) {
            list.push(record);
        } else {
            let old = list[index];
            let newRecord = Object.assign(new (<any> old.constructor)(), old);
            copyDefinedProperties(newRecord, record);
            list[index] = newRecord;
        }
        return t;
    }

    addEnv(record: EnvironmentRecord) {
        return this.add("envs", record, (r1, r2) => r1.name === r2.name);
    }

    addProject(record: ProjectRecord) {
        return this.add("projects", record, (r1, r2) => r1.projectName === r2.projectName);
    }

    addAssign(record: Assignment) {
        return this.add("assigns", record, (r1, r2) => r1.id === r2.id);
    }

    addHost(record: HostRecord) {
        return this.add("hosts", record, (r1, r2) => r1.name === r2.name && r1.env === r2.env);
    }

    addHostGroup(record: HostGroupRecord) {
        return this.add("hostGroups", record, (r1, r2) => r1.name === r2.name && r1.env === r2.env);
    }
}

export const AssignmentScope = {
    environment: "environment",
    project: "project"
};

export class Assignment {
    id: string;
    envName: string;
    projectName: string;
    scope: string;
    variableInfo: VariableInfo;
    disabled: boolean;

    constructor(json = undefined) {
        if (json) {
            this.id = json.id;
            this.envName = json.envName;
            this.projectName = json.projectName;
            this.scope = json.scope;
            this.variableInfo = json.variableInfo instanceof VariableInfo ? json.variableInfo : new VariableInfo(json.variableInfo);
            this.disabled = json.disabled;
        }
    }

    static createAssignment(props = {}): Assignment {
        return new Assignment({id: VariableInfo.nextID(), ...props});
    }

    clone(): this {
        return Object.assign(new Assignment(), this);
    }

    update(delta): this {
        return Object.assign(this.clone(), delta);
    }

    static compareId(id1: string, id2: string): number {
        let i = 0, j = 0;
        while (true) {
            let k = id1.indexOf('.', i), l = id2.indexOf('.', j);

            let s: string = k < 0 ? id1.substring(i) : id1.substring(i, k);
            let t: string = l < 0 ? id2.substring(j) : id2.substring(j, l);

            let x = Number.parseInt(s), y = Number.parseInt(t);
            if (x < y) return -1;
            if (x > y) return 1;
            if (k < 0 && l < 0) return 0;
            if (k < 0) return -1;
            if (l < 0) return 1;

            i = k + 1;
            j = l + 1;
        }
    }

    /**
     * insert an assignment record to a variable info list,
     * by the id order defined in compareId.
     * we assure that all variable infos with id defined are at the end of the list
     * and are already sorted by the compareId.
     * @param list
     */
    insertToVariableInfoList(list: VariableInfo[]): void {
        if (this.disabled) {
            // disabled records only used to remove all previous records with the same id
            for (let i = 0; i < list.length; i++) {
                if (list[i].id === this.id) {
                    list.splice(i--, 1); // recheck the new element at the i index
                }
            }
            return;
        }

        let self = this.variableInfo.update({id: this.id});
        for (let i = list.length - 1; i >= 0; i--) {
            let info = list[i];
            if (!info.id) {
                list.splice(i + 1, 0, self);
                return;
            }
            let compare = Assignment.compareId(info.id, this.id);
            if (compare === 0) {
                list[i] = self;
                return;
            }
            if (compare < 0) { // we got the first one who smaller than us
                list.splice(i + 1, 0, self);
                return;
            }
        }
        // insert to the beginning of the list, since no one is smaller than us
        list.unshift(self);
    }
}

export class EnvironmentRecord {
    id: number;
    name: string;
    abstracted: boolean;
    disabled: boolean;
    description: string;
    parents: string[];
    labels: string[];

    constructor(json: any = {}) {
        Object.assign(this, json);
    }
}

export class HostGroupRecord {
    id: number;
    env: string;
    name: string;
    description: string;
    overrideHosts: boolean;
    hosts: string[];
    inherits: string[];
    inheritsRetired: string[];
    disabled: boolean;

    constructor(json: any = {}) {
        Object.assign(this, json);
    }
}

export class HostRecord {
    id: number;
    env: string;
    name: string;
    user: string;
    port: number;
    channel: string;
    retired: boolean;
    disabled: boolean;
    labels: object;
    description: string;

    constructor(json: any = {}) {
        Object.assign(this, json);
    }
}

export class ProjectRecord {
    projectName: string;
    projectNameGenerator: {groovy: string};
    variableGroupGenerator: {groovy: string};
    key: string;
    id: number;
    activeInEnv: string;
    description: string;
    parents: string[];
    abstracted: Boolean;
    disabled: boolean;
    playbookName: string;
    when: {groovy: string}[];
    includedInEnv: string[];
    includedOnlyInEnv: string[];
    excludedInEnv: string[];
    sharing: Map<string, string>;

    constructor(json: any = {}) {
        Object.assign(this, json);
    }
}

export function applyRecordsToMap<

    R extends {id: string | number, disabled: boolean},
    T extends {id: number | string, withRecord: (r: R) => T}

    >(records: R[], getKey: (r: R) => string, target: Map<string, T>, creator: (r: R) => T): void {

    for (let record of records) {
        let key = getKey(record);
        let value = target.get(key);
        if (value) {
            if (value.id && record.disabled) {
                target.delete(key);
            } else {
                target.set(key, value.withRecord(record));
            }
        } else {
            target.set(key, creator(record));
        }
    }
}