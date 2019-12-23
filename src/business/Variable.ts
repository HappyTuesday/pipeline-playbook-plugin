import {Closure} from "./Closure";
import {SimpleVariables, Variables} from "./Variables";
import {mapValues} from "../functions/collection";

export class VariableInfo {

    private static MAX_ID: number = 0;

    public static updateMaxID(id: string) {
        if (id === null || id === undefined) return;
        let i = id.indexOf('.');
        if (i > 0) {
            id = id.substring(0, i);
        }
        let n = Number.parseInt(id);
        if (n > VariableInfo.MAX_ID) {
            VariableInfo.MAX_ID = n;
        }
    }

    public static nextID(): string {
        return String(++VariableInfo.MAX_ID);
    }

    name: string;
    id: string;
    type: string;
    closure: Closure;
    value: any;
    variable: VariableInfo;
    list: VariableInfo[];
    $map: Map<string, VariableInfo>;
    choices: any[];
    option: any;

    constructor({name, id, type, closure, value, variable, list, map, choices, option}) {
        this.name = name;
        this.id = id;
        this.type = type;
        this.closure = closure ? new Closure(closure) : null;
        this.value = value;
        this.variable = variable ? new VariableInfo(variable) : null;
        this.list = list ? list.map(x => new VariableInfo(x)) : null;
        this.$map = map ? mapValues(map, x => new VariableInfo(x as any)) : null;
        this.choices = choices;
        this.option = option;

        VariableInfo.updateMaxID(id);
    }

    clone(): this {
        return Object.assign(new VariableInfo(<any>{}), this);
    }

    update(delta: {}): this {
        return Object.assign(this.clone(), delta);
    }

    /**
     * detach the id and name from this variable info
     */
    dehydrate(): this {
        let c = this.clone();
        delete c.name;
        delete c.id;
        return c;
    }
}

export class VariableName {

    static REPEATABLE_NAME = "*";

    path: string[];

    /**
     * create a variable name
     */
    constructor(name) {
        this.path = name instanceof Array ? name : name.split('.');
    }

    first(): string {
        return this.path[0];
    }

    last(): string {
        return this.path[this.path.length - 1];
    }

    field(fieldName: string): VariableName {
        if (!fieldName || VariableName.REPEATABLE_NAME === fieldName) {
            throw new Error("invalid field name " + fieldName);
        }

        let path = Array.from(this.path);
        path.push(fieldName);

        return new VariableName(path);
    }

    repeatable(): boolean {
        return VariableName.REPEATABLE_NAME === this.last();
    }

    toRepeatable(): VariableName {
        return new VariableName([...this.path, VariableName.REPEATABLE_NAME]);
    }

    /**
     * check if this variable name is a child of another variable name
     * which means that the beginning part of this variable name is the entire path of the another one
     */
    belongsTo(another: VariableName): boolean {
        if (another.path.length > this.path.length) {
            return false;
        }
        for (let i = 0; i < another.path.length; i++) {
            if (another.path[i] !== this.path[i]) {
                return false;
            }
        }
        return true;
    }

    toString(): string {
       return this.path.join('.');
    }

    /**
     * parse string or variableName formatted name to typed variable name
     */
    static parse(name: string | VariableName): VariableName {
        if (name instanceof VariableName) {
            return name;
        }
        return new VariableName(name);
    }
}

export class Variable {

    readonly info: VariableInfo;
    readonly id: string;
    readonly type: string;

    closure: Closure;
    value: any;
    choices: any[];

    variable: Variable;
    list: Variable[];
    $map: Map<string, Variable>;
    option: any;

    name: VariableName;
    cradle: SimpleVariables;

    /**
     * create variable from variable info
     */
    protected constructor(info: VariableInfo = undefined, cradle: SimpleVariables = undefined) {
        this.cradle = cradle;

        if (info) {
            this.info = info;
            this.id = info.id;
            this.type = info.type;

            this.closure = info.closure;
            this.value = info.value;
            this.choices = info.choices;

            this.variable = info.variable ? Variable.toVariable(info.variable) : null;
            this.list = info.list ? info.list.map(x => Variable.toVariable(x)) : null;
            this.$map = info.$map ? mapValues(info.$map, x => Variable.toVariable(x)) : null;
            this.option = info.option;

            this.name = info.name ? VariableName.parse(info.name) : null;
        }
    }

    /**
     * folk this variable
     */
    folk(): this {
        return Object.assign(new (this.constructor as any), this);
    }

    /**
     * @param {VariableName} name
     * @return {Variable}
     */
    withName(name: VariableName) {
        if (name === this.name) {
            return this;
        }
        let v = this.folk();
        v.name = name;
        return v;
    }

    /**
     *
     * @param {SimpleVariables} cradle
     */
    withCradle(cradle: SimpleVariables) {
        if (cradle === this.cradle) {
            return this;
        }
        let v = this.folk();
        v.cradle = cradle;
        return v;
    }

    /**
     * convert anything to variable
     */
    static toVariable(value: Variable | VariableInfo | any, cradle: SimpleVariables = undefined): Variable {
        if (value instanceof Variable) {
            return value.withCradle(cradle);
        }
        if (value instanceof VariableInfo) {
            let constructor = VariableTypes[value.type] || VariableTypes.unknown;
            return new constructor(value, cradle);
        }
        return new SimpleVariable(new VariableInfo({value: value, type: "simple"} as any), cradle);
    }
}

export class AbstractedVariable extends Variable {
    static desc = "abstracted";

    static createEmpty(name: string = undefined): VariableInfo {
        return new VariableInfo(<any>{name, type: 'abstracted'});
    }
}

export class ClosureVariable extends Variable {
    static desc = "closure";

    static createEmpty(name: string = undefined): VariableInfo {
        return new VariableInfo(<any>{name, type: 'closure', closure: {}});
    }
}

export class EncryptedVariable extends Variable {
    static desc = "encrypted variable";

    static canWrap(from: Variable): boolean {
        return from instanceof SimpleVariable;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "encrypted", variable: from.info.dehydrate()});
    }
}

export class CachedVariable extends Variable {
    static desc = "cached variable";

    static canWrap(): boolean {
        return true;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "cached", variable: from.info.dehydrate()});
    }
}

export class SimpleVariable extends Variable {
    static desc = "simple variable";

    static createEmpty(name: string = undefined): VariableInfo {
        return new VariableInfo(<any>{name, type: 'simple', value: ''});
    }
}

export class LazyVariable extends Variable {
    static desc = "lazy variable";

    static createEmpty(name: string = undefined): VariableInfo {
        return new VariableInfo(<any>{name, type: 'lazy', closure: {}});
    }
}

export class TransformVariable extends Variable {

    constructor(info: VariableInfo = new VariableInfo(<any>{type: "transform"}), cradle: SimpleVariables = undefined) {
        super(info, cradle);
    }

    static desc = "transform variable";

    static canWrap(): boolean {
        return true;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "transform", variable: from.info.dehydrate(), closure: {}});
    }
}

export class UserParameter {
    type: string;
    description: string;
    required: boolean;
    hidden: boolean;
    persistent: boolean;
    choices: ListVariable;
    order: number;
    options: MapVariable;

    constructor({type, description, required, hidden, persistent, choices, order, options}) {
        this.type =type;
        this.description = description;
        this.required = required;
        this.hidden = hidden;
        this.persistent = persistent;
        if (choices) {
            this.choices = <ListVariable> Variable.toVariable(new VariableInfo(choices));
        }
        this.order = order;
        if (options) {
            this.options = <MapVariable> Variable.toVariable(new VariableInfo(options));
        }
    }
}

export class UserParameterVariable extends Variable {

    private _parameter: UserParameter;

    get parameter(): UserParameter {
        if (!this._parameter) {
            this._parameter = new UserParameter(this.option);
        }
        return this._parameter;
    }

    static desc = "user parameter variable";

    static createEmpty(name: string = undefined): VariableInfo {
        return new VariableInfo(<any>{name, type: 'userParameter', variable: SimpleVariable.createEmpty()});
    }
}

interface ContextualVariableProxyTarget {
    get(p: string | number): any;
    set(p: string | number, value: any);
    has(p: string | number): boolean;
}

class ContextualVariableProxyHandler<T extends ContextualVariableProxyTarget> implements ProxyHandler<T> {
    get(target: T, p: PropertyKey, receiver: any): any {
        if (p in target) {
            return target[p];
        }
        if ((typeof p === "string" || typeof p === "number") &&
            typeof target.get === "function") {

            return target.get(p);
        }
    }

    has(target: T, p: PropertyKey): boolean {
        if (p in target) {
            return true;
        }
        if ((typeof p === "string" || typeof p === "number") &&
            typeof target.has === "function") {

            return target.has(p);
        }
    }

    set(target: T, p: PropertyKey, value: any, receiver: any): boolean {
        if (p in target) {
            target[p] = value;
            return true;
        }
        if ((typeof p === "string" || typeof p === "number") &&
            typeof target.set === "function") {

            return target.set(p, value);
        }
        return false;
    }
}

export abstract class ContextualVariable extends Variable {
}

export class AppendedListVariable extends Variable {
    static desc = "appended list variable";

    static canWrap(): boolean {
        return true;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "appendedList", variable: from.info.dehydrate()});
    }
}

export class ExpandableListVariable extends Variable {
    static desc = "expandable list variable";

    static canWrap(): boolean {
        return true;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "expandableList", variable: from.info.dehydrate()});
    }
}

export class ExpandableMapVariable extends Variable {
    static desc = "expandable map variable";

    static canWrap(): boolean {
        return true;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "expandableMap", variable: from.info.dehydrate()});
    }
}

export abstract class ListVariable extends ContextualVariable {
}

export class SimpleListVariable extends ListVariable {
    getRawList() {
        return this.list.map(v => ({variable: v, cascaded: false}));
    }
}

export class FilterListVariable extends ListVariable {
    static desc = "filter list variable";

    static canWrap(from: Variable): boolean {
        return from instanceof ListVariable;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "filterList", variable: from.info.dehydrate(), closure: {}});
    }
}

export class LazyListVariable extends ListVariable {
    static desc = "lazy list variable";

    static canWrap(from: Variable): boolean {
        return from instanceof LazyVariable;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "lazyList", variable: from.info.dehydrate()});
    }
}

export class TransformListVariable extends ListVariable {
    static desc = "transform list variable";

    static canWrap(from: Variable): boolean {
        return from instanceof ListVariable;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "transformList", variable: from.info.dehydrate(), closure: {}});
    }
}

export class CascadeListVariable extends ListVariable {
    getRawList(where: Variables): {cascaded: boolean, variable: Variable}[] {
        let ls: {cascaded: boolean, variable: Variable}[] = [];
        let append = (v: Variable, cascaded: boolean) => {
            let w = v.withName(this.name.field(ls.length.toString()));
            let u = where.get(w.name);
            ls.push({cascaded: cascaded || !!u, variable: u || w});
        };

        if (this.list) {
            for (let v of this.list) {
                append(v, false);
            }
        }

        for (let v of where.fields(this.name)) {
            if (v.type === "appendedList" || v.type === "expandableList") {
                append(v, true);
            }
        }

        return ls;
    }

    static desc = "cascade list variable";

    static createEmpty(name: string): VariableInfo {
        return new VariableInfo(<any>{name, type: 'cascadeList', list: []});
    }
}

export abstract class MapVariable extends ContextualVariable {
}

// applyMixins(MapVariable, [gs.map().constructor]);

export class SimpleMapVariable extends MapVariable {
    getRawMap(): Variable[] {
        let list = [];
        for (let [key, variable] of this.$map) {
            list.push({key, variable, cascaded: false});
        }
        return list;
    }
}

export class LazyMapVariable extends MapVariable {
    static desc = "lazy map variable";

    static canWrap(from: Variable): boolean {
        return from instanceof LazyVariable;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "lazyMap", variable: from.info.dehydrate()});
    }
}

export class FilterMapVariable extends MapVariable {
    static desc = "filter map variable";

    static canWrap(from: Variable): boolean {
        return from instanceof MapVariable;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "filterMap", variable: from.info.dehydrate(), closure: {}});
    }
}

export class TransformMapVariable extends MapVariable {
    static desc = "transform map variable";

    static canWrap(from: Variable): boolean {
        return from instanceof MapVariable;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "transformMap", variable: from.info.dehydrate(), closure: {}});
    }
}

export class CascadeMapVariable extends MapVariable {
    getRawMap(where: Variables): {key: string, variable: Variable, cascaded: boolean}[] {
        let list: {key: string, variable: Variable, cascaded: boolean}[] = [];

        let put = (key: string, v: Variable, cascaded: boolean) => {
            if (key !== '*' && list.find(x => x.key === key)) {
                return; // ignore duplicated (hidden) variables
            }
            list.push({key, variable: v.withName(this.name.field(key)), cascaded: cascaded});
        };

        for (let v of where.reverseFields(this.name)) {
            put(v.name.last(), v, true);
        }

        if (this.$map) {
            for (let [key, v] of this.$map) {
                put(key, v, false);
            }
        }

        return list;
    }

    static desc = "cascade map variable";

    static createEmpty(name: string = undefined): VariableInfo {
        return new VariableInfo(<any>{name, type: 'cascadeMap', $map: new Map()});
    }
}

export class Map2listVariable extends ListVariable {
    static desc = "map to list variable";

    static canWrap(from: Variable): boolean {
        return from instanceof MapVariable;
    }

    static wrap(from: Variable): VariableInfo {
        let {info: {id, name}} = from;
        return new VariableInfo(<any>{id, name, type: "map2listMap", variable: from.info.dehydrate()});
    }
}

export const VariableTypes = {
    unknown: Variable,
    abstracted: AbstractedVariable,
    appendedList: AppendedListVariable,
    cached: CachedVariable,
    cascadeList: CascadeListVariable,
    cascadeMap: CascadeMapVariable,
    closure: ClosureVariable,
    encrypted: EncryptedVariable,
    expandableList: ExpandableListVariable,
    expandableMap: ExpandableMapVariable,
    filterList: FilterListVariable,
    filterMap: FilterMapVariable,
    lazyList: LazyListVariable,
    lazyMap: LazyMapVariable,
    map2list: Map2listVariable,
    simpleList: SimpleListVariable,
    simpleMap: SimpleMapVariable,
    simple: SimpleVariable,
    lazy: LazyVariable,
    transformList: TransformListVariable,
    transformMap: TransformMapVariable,
    transform: TransformVariable,
    userParameter: UserParameterVariable
};

export const VariableTypeList = [];
for (let p in VariableTypes) {
    if (VariableTypes.hasOwnProperty(p)) {
        VariableTypeList.push(VariableTypes[p])
    }
}