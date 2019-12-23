import {Variable, VariableInfo, VariableName} from './Variable'
import {SimpleIterator} from "../functions/iterator";

export abstract class Variables {

    source: string;

    /**
     * construct a variable table with source
     * @param source variable table source, used for showing helpful info
     * @constructor
     */
    protected constructor(source: string) {
        this.source = source;
    }

    /**
     * check if this variable table is empty
     * @return return true if we are empty
     */
    abstract isEmpty(): boolean;

    /**
     * check if contains the variable
     */
    abstract contains(name: VariableName): boolean;

    /**
     * check if contains any children (or children's children) of the given variable name
     */
    abstract containsChildren(name: VariableName): boolean;

    /**
     * check if the variable with given name is hidden by this variable table,
     * a variable is hidden only if there is a variable with the same name or its parent name
     */
    abstract hidden(name: VariableName): boolean;

    /**
     * get a variable by its name, can only get non-repeatable variables
     * including invisible variable
     */
    abstract getWithInvisible(name: VariableName): Variable | null;

    /**
     * get a variable by its name, can only get non-repeatable variables
     */
    get(name: string | VariableName): Variable | null {
        let v = this.getWithInvisible(VariableName.parse(name));
        return v === Variables.INVISIBLE ? null : v;
    }

    /**
     * get all fields defined under the variable of the name,
     * in the order at which the variables are put
     *
     * @param name variable name
     * @return an iterator iterating all fetched variables
     */
    abstract fields(name: VariableName): SimpleIterator<Variable>;

    /**
     * get all fields defined under the variable of the name,
     * in the reverse order at which the variables are put
     *
     * @param name variable name
     * @return an iterator iterating all fetched variables
     */
    abstract reverseFields(name: VariableName): SimpleIterator<Variable>;

    /**
     * iterate all variables, in the order at which the variables are put
     */
    abstract variables(): SimpleIterator<Variable>;

    /**
     * iterate all variables (does not use hidden policy), in the order at which the variable are put
     * @return iterator
     */
    abstract allVariables(): SimpleIterator<Variable>;

    /**
     * collect all top variables (variables which have no parent variables in the entire variable table),
     * in the order at which the variables are put
     */
    topVariables(): Variable[] {
        let vs: Variable[] = [];
        for (let v of this.variables()) {
            if (v.name.path.length === 1 || vs.every(vv => !v.name.belongsTo(vv.name))) {
                vs.push(v);
            }
        }
        return vs;
    }

    /**
     * check if a variable exists
     * @param name variable name
     * @return true if exists
     */
    exists(name: VariableName | string): boolean {
        return this.get(name) != null;
    }

    /**
     * put a variable
     *
     * @param variable the variable to put
     */
    abstract put(variable: Variable);

    /**
     * put all variables defined in the variable table
     * @param vars variable table
     */
    merge(vars: Variables) {
        for (let v of vars.variables()) {
            this.put(v);
        }
    }

    /**
     * clear all variables in this table
     */
    abstract clear();

    static INVISIBLE: any = {};
}

export class SimpleVariables extends Variables {

    /**
     * construct a variable table with source
     * @param {VariableInfo[]} list
     * @param {string} source variable table source, used for showing helpful info
     * @constructor
     */
    constructor(list: VariableInfo[], source) {
        super(source);
        for (let info of list) {
            this.put(Variable.toVariable(info, this));
        }
    }

    root = new ComplexWrapper(null);

    /**
     * check if this variable table is empty
     * @return {boolean} return true if we are empty
     */
    isEmpty() {
        return !this.root.hasChildren();
    }

    /**
     * check if contains the variable
     * @param {VariableName} name variable name
     * @return {boolean}
     */
    contains(name) {
        let w = this.navigate(name);
        return w && !!w.variable;
    }

    /**
     * check if contains any children (or children's children) of the given variable name
     * @param {VariableName} name
     * @return {boolean}
     */
    containsChildren(name) {
        let w = this.navigate(name);
        return w instanceof ComplexWrapper && w.hasChildren();
    }

    /**
     * check if the variable with given name is hidden by this variable table,
     * a variable is hidden only if there is a variable with the same name or its parent name
     *
     * @param {VariableName} name variable name
     * @return {boolean} true if the name is hidden
     */
    hidden(name: VariableName): boolean {
        let w: Wrapper = this.root;
        for (let field of name.path) {
            w = (w as ComplexWrapper).field(field);
            if (w == null) {
                return false;
            }
            if (!(w instanceof ComplexWrapper) || w.variable != null) {
                return true;
            }
        }
        return false;
    }

    /**
     * get a variable by its name, can only get non-repeatable variables
     * including invisible variable
     *
     * @param {VariableName} name variable name
     * @return {Variable} retrieved variable
     */
    getWithInvisible(name: VariableName): Variable | null {
        let w: Wrapper = this.root;
        let invisible = false;
        for (let field of name.path) {
            if (w instanceof ComplexWrapper) {
                invisible = invisible || w.variable != null;
                w = w.field(field);
                if (w == null) {
                    return invisible ? Variables.INVISIBLE : null;
                }
            } else {
                return Variables.INVISIBLE;
            }
        }
        return invisible && w.variable == null ? Variables.INVISIBLE : w.variable;
    }

    /**
     * get all fields defined under the variable of the name,
     * in the order at which the variables are put
     *
     * @param {VariableName} name variable name
     * @return {IterableIterator<Variable>} an iterator iterating all fetched variables
     */
    fields(name: VariableName): SimpleIterator<Variable> {
        let w = this.navigate(name);
        if (w instanceof ComplexWrapper) {
            return w.fields();
        } else {
            return SimpleIterator.empty();
        }
    }

    /**
     * get all fields defined under the variable of the name,
     * in the reverse order at which the variables are put
     *
     * @param {VariableName} name variable name
     * @return {IterableIterator<Variable>} an iterator iterating all fetched variables
     */
    reverseFields(name: VariableName): SimpleIterator<Variable> {
        let w = this.navigate(name);
        if (w instanceof ComplexWrapper) {
            return w.reverseFields();
        } else {
            return SimpleIterator.empty();
        }
    }

    /**
     * iterate all variables, in the order at which the variables are put
     *
     * @return {IterableIterator<Variable>} iterator
     */
    variables(): SimpleIterator<Variable> {
        return this.root.travel();
    }

    allVariables(): SimpleIterator<Variable> {
        return this.root.travel();
    }

    /**
     * get all children (and children's children) of the given variable
     * @param {VariableName} name
     * @return {IterableIterator<Variable>} iterator
     */
    children(name: VariableName): SimpleIterator<Variable> {
        let w = this.navigate(name);
        return w instanceof ComplexWrapper ? w.children() : SimpleIterator.empty();
    }

    /**
     * put a variable
     *
     * @param {Variable} variable the variable to put
     */
    put(variable: Variable) {
        this.createDir(variable.name).put(variable.withCradle(this));
    }

    /**
     * clear all variables in this table
     */
    clear() {
        this.root.clear();
    }

    /**
     * @param {VariableName} name
     * @return {ComplexWrapper}
     */
    createDir(name) {
        let w = this.root;

        for (let i = 0; i < name.path.length - 1; i++) {
            let field = name.path[i];
            let c = w.field(field);
            if (c instanceof ComplexWrapper) {
                w = c;
            } else {
                w = w.dir(field, c == null ? null : c.variable);
            }
        }

        return w;
    }

    /**
     * navigate to the final node with the variable name
     * @param {VariableName} name variable name
     * @return {Wrapper} final node or null if not find
     */
    navigate(name: VariableName): Wrapper {
        let w: Wrapper = this.root;
        for (let field of name.path) {
            if (w instanceof ComplexWrapper) {
                w = w.field(field);
                if (w == null) {
                    return null;
                }
            } else {
                return null;
            }
        }
        return w;
    }
}

class Wrapper {
    /**
     * create wrapper
     * @param {Variable} variable
     */
    constructor(public variable: Variable) {
    }

    /**
     * iterate all variables
     * @return {IterableIterator<Variable>}
     */
    travel(): SimpleIterator<Variable> {
        return SimpleIterator.singleton(this.variable);
    }
}

class ComplexWrapper extends Wrapper {

    head: Node = null;
    tail: Node = null;
    map: Map<string, Node> = new Map();

    /**
     * create complex wrapper
     * @param {Variable} variable
     */
    constructor(variable: Variable) {
        super(variable);
    }

    /**
     * @param {string} name
     * @param {Variable} v
     * @return {ComplexWrapper}
     */
    dir(name, v) {
        this.removeNode(name);
        let w = new ComplexWrapper(v);
        let n = new Node(w);
        this.insertNode(n);
        this.map.set(name, n);
        return w;
    }

    /**
     * @param {Variable} v
     */
    put(v) {
        if (v.name.repeatable()) {
            this.insertNode(new Node(new Wrapper(v)));
        } else {
            let name = v.name.last();
            this.removeNode(name);
            let n = new Node(new Wrapper(v));
            this.insertNode(n);
            this.map.set(name, n);
        }
    }

    /**
     * @param {Node} n
     */
    insertNode(n) {
        if (this.tail !== null) {
            this.tail.next = n;
            n.prev = this.tail;
        }
        this.tail = n;
        if (this.head === null) {
            this.head = n;
        }
    }

    /**
     * @param {string} name
     */
    removeNode(name) {
        let n = this.map.get(name);
        if (n == null) {
            return;
        }

        if (n.next == null) {
            if (n !== this.tail) {
                throw new Error("illegal status");
            }
            this.tail = n.prev;
        } else {
            n.next.prev = n.prev;
        }

        if (n.prev == null) {
            if (n !== this.head) {
                throw new Error("illegal status");
            }
            this.head = n.next;
        } else {
            n.prev.next = n.next;
        }
    }

    /**
     * @return {boolean}
     */
    hasChildren() {
        return !!this.head;
    }

    /**
     * iterate all children
     * @return {IterableIterator<Variable>}
     */
    children(): SimpleIterator<Variable> {
        let n = this.head;
        let iter: SimpleIterator<Variable> = SimpleIterator.empty();

        return new SimpleIterator(() => {
            while (true) {
                let {value, done} = iter.next();
                if (done) {
                    if (n) {
                        iter = n.wrapper.travel();
                        n = n.next;
                    } else {
                        return undefined;
                    }
                } else {
                    return value;
                }
            }
        });
    }

    /**
     * iterate all variables
     * @return {IterableIterator<Variable>}
     */
    travel(): SimpleIterator<Variable> {
        let iter = null;
        return new SimpleIterator(() => {
            if (iter === null) { // the very first time of this iterating
                iter = this.children();// avoid entering this branch next time
                if (this.variable) {
                    return this.variable;
                }
            }

            let {value, done} = iter.next();
            if (done) {
                return undefined;
            } else {
                return value;
            }
        });
    }

    /**
     * @param {string} name
     * @return {Wrapper}
     */
    field(name): Wrapper {
        let n = this.map.get(name);
        return n == null ? null : n.wrapper;
    }

    /**
     * @return {IterableIterator<Variable>}
     */
    fields(): SimpleIterator<Variable> {
        if (this.head) {
            let n = this.head;
            return new SimpleIterator(() => {
                while (n) {
                    let v = n.wrapper.variable;
                    n = n.next;
                    if (v) {
                        return v;
                    }
                }
            })
        } else {
            return SimpleIterator.empty();
        }
    }

    /**
     * iterate all fields
     * @return {IterableIterator<Variable>}
     */
    reverseFields(): SimpleIterator<Variable> {
        if (this.tail) {
            let n = this.tail;
            return new SimpleIterator(() => {
                while (n) {
                    let v = n.wrapper.variable;
                    n = n.prev;
                    if (v) {
                        return v;
                    }
                }
            })
        } else {
            return SimpleIterator.empty();
        }
    }

    clear() {
        this.map.clear();
        this.head = null;
        this.tail = null;
    }
}

class Node {
    /**
     * @type {Node}
     */
    prev: Node = null;
    /**
     * @type {Node}
     */
    next: Node = null;

    /**
     * @param {Wrapper} wrapper
     */
    constructor(public wrapper: Wrapper) {
    }
}

export class LayeredVariables extends Variables {
    /**
     * @type {Variables[]}
     */
    layers: Variables[];
    /**
     * writable layer
     */
    writable: Variables;

    /**
     * construct a variable table with source
     * @param {string} source variable table source, used for showing helpful info
     * @param {Iterable<Variables>} layers initial layers
     * @constructor
     */
    constructor(source, layers = []) {
        super(source);
        this.layers = Array.from(layers);
    }

    /**
     * check if this variable table is empty
     * @return {boolean} return true if we are empty
     */
    isEmpty() {
        if (this.layers.length === 0) {
            return true;
        }

        for (let l of this.layers) {
            if (!l.isEmpty()) {
                return false;
            }
        }
        return true;
    }

    /**
     * check if contains the variable
     * @param {VariableName} name variable name
     * @return {boolean}
     */
    contains(name) {
        for (let i = this.layers.length - 1; i >= 0; i--) {
            if (this.layers[i].contains(name)) {
                return true;
            }
        }
        return false;
    }

    /**
     * check if contains any children (or children's children) of the given variable name
     * @param {VariableName} name
     * @return {boolean}
     */
    containsChildren(name) {
        for (let i = this.layers.length - 1; i>= 0; i--) {
            if (this.layers[i].containsChildren(name)) {
                return true;
            }
        }
        return false;
    }

    /**
     * check if the variable with given name is hidden by this variable table,
     * a variable is hidden only if there is a variable with the same name or its parent name
     *
     * @param {VariableName} name variable name
     * @return {boolean} true if the name is hidden
     */
    hidden(name) {
        for (let l of this.layers) {
            if (l.hidden(name)) {
                return true;
            }
        }
        return false;
    }

    /**
     * get a variable by its name, can only get non-repeatable variables
     * including invisible variable
     *
     * @param {VariableName} name variable name
     * @return {Variable} retrieved variable
     */
    getWithInvisible(name) {
        for (let i = this.layers.length - 1; i >= 0; i--) {
            let v = this.layers[i].getWithInvisible(name);
            if (v != null) {
                return v;
            }
        }
        return null;
    }

    iterateForward(visitLayer: (layer: Variables) => SimpleIterator<Variable>): SimpleIterator<Variable> {
        if (this.layers.length === 0) {
            return SimpleIterator.empty();
        } else if (this.layers.length === 1) {
            return visitLayer(this.layers[0]);
        } else {
            let i = 0;
            let iter: SimpleIterator<Variable> = SimpleIterator.empty();
            return new SimpleIterator(() => {
                while (true) {
                    let {value, done} = iter.next();
                    if (done) {
                        if (i < this.layers.length) {
                            iter = visitLayer(this.layers[i++]);
                        } else {
                            return undefined;
                        }
                    } else if (this.unhidden(value.name, i)) { // since iter is calculated from i - 1
                        return value;
                    }
                }
            });
        }
    }

    iterateBackward(visitLayer: (layer: Variables) => SimpleIterator<Variable>): SimpleIterator<Variable> {
        if (this.layers.length === 0) {
            return SimpleIterator.empty();
        } else if (this.layers.length === 1) {
            return visitLayer(this.layers[0]);
        } else {
            let i = this.layers.length - 1;
            let iter: SimpleIterator<Variable> = SimpleIterator.empty();
            return new SimpleIterator(() => {
                while (true) {
                    let {value, done} = iter.next();
                    if (done) {
                        if (i >= 0) {
                            iter = visitLayer(this.layers[i--]);
                        } else {
                            return undefined;
                        }
                    } else if (this.unhidden(value.name, i + 2)) { // since iter is calculated from i + 1
                        return value;
                    }
                }
            });
        }
    }

    /**
     * get all fields defined under the variable of the name,
     * in the order at which the variables are put
     *
     * @param {VariableName} name variable name
     * @return {IterableIterator<Variable>} an iterator iterating all fetched variables
     */
    fields(name): SimpleIterator<Variable> {
        return this.iterateForward(l => l.fields(name));
    }

    /**
     * get all fields defined under the variable of the name,
     * in the reverse order at which the variables are put
     *
     * @param {VariableName} name variable name
     * @return {IterableIterator<Variable>} an iterator iterating all fetched variables
     */
    reverseFields(name): SimpleIterator<Variable> {
        return this.iterateBackward(l => l.reverseFields(name));
    }

    /**
     * iterate all variables, in the order at which the variables are put
     * @return {IterableIterator<Variable>}
     */
    variables(): SimpleIterator<Variable> {
        return this.iterateForward(l => l.variables());
    }

    allVariables(): SimpleIterator<Variable> {
        if (this.layers.length === 0) {
            return SimpleIterator.empty();
        } else if (this.layers.length === 1) {
            return this.layers[0].allVariables();
        } else {
            let i = 0;
            let iter: SimpleIterator<Variable> = SimpleIterator.empty();
            return new SimpleIterator(() => {
                while (true) {
                    let {value, done} = iter.next();
                    if (done) {
                        if (i < this.layers.length) {
                            iter = this.layers[i++].allVariables();
                        } else {
                            return undefined;
                        }
                    } else {
                        return value;
                    }
                }
            });
        }
    }

    /**
     * add a new layer
     *
     * @param {Variables[]} layers new layer
     * @return {LayeredVariables} this
     */
    addLayers(layers): this {
        for (let l of layers) {
            this.layers.push(l);
        }
        return this;
    }

    /**
     * add a new layer
     *
     * @param {Variables} layer new layer
     * @return {LayeredVariables} this
     */
    addLayer(layer): this {
        this.layers.push(layer);
        return this;
    }

    /**
     * set writable layer
     * @param {Variables} layer
     */
    setWritableLayer(layer) {
        this.writable = layer;
    }

    /**
     * check if the variable is not hidden after index of layers
     * @param {VariableName} name
     * @param {int} index
     */
    unhidden(name, index) {
        for (let i = index; i < this.layers.length; i++) {
            if (this.layers[i].hidden(name)) {
                return false;
            }
        }
        return true;
    }

    /**
     * clear all variables in this table
     */
    clear() {
        this.layers = [];
        this.writable = null;
    }

    /**
     * put a variable
     *
     * @param variable the variable to put
     */
    put(variable: Variable) {
        if (this.writable) {
            this.writable.put(variable);
        } else {
            throw new Error("writable is not set");
        }
    }
}