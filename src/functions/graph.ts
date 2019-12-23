import {removeItem} from "./collection";

class Node<T> {

    readonly name: string;
    data: T;

    readonly prev = [];
    readonly next = [];

    constructor(name: string, data: T) {
        this.name = name;
        this.data = data;
    }
}

export class Graph<T, A> {
    private readonly nodes: Map<string, Node<T>> = new Map();
    /**
     * start node name -> end node name -> arc data
     * @type {Map<String, Map<String, *>>}
     */
    private readonly arcs: Map<string, Map<string, A>> = new Map();

    node(name: string, data: any): this {
        if (this.nodes.has(name)) {
            this.nodes.get(name).data = data;
        } else {
            this.nodes.set(name, new Node(name, data));
        }
        return this;
    }

    /**
     * if contains node
     */
    containsNode(name: string): boolean {
        return this.nodes.has(name);
    }

    /**
     * get the data of a node
     */
    getAt(name: string): T {
        let node = this.nodes.get(name);
        return node == null ? null : node.data;
    }

    /**
     * put data to a node
     */
    putAt(name: string, data: T): T {
        if (this.nodes.has(name)) {
            this.nodes.get(name).data = data;
            return data;
        } else {
            throw new Error("invalid node name " + name);
        }
    }

    /**
     * add arc from a node to another node
     * @param {string} from
     * @param {string} to
     * @param data
     * @return {Graph}
     */
    arc(from: string, to: string, data: A = null): this {
        let fromNode, toNode;
        if (this.nodes.has(from)) {
            fromNode = this.nodes.get(from);
        } else {
            fromNode = new Node(from, null);
            this.nodes.set(from, fromNode);
        }

        if (this.nodes.has(to)) {
            toNode = this.nodes.get(to);
        } else {
            toNode = new Node(to, null);
            this.nodes.set(to, toNode);
        }

        if (fromNode.next.indexOf(toNode) < 0) {
            fromNode.next.push(toNode);
        }
        if (toNode.prev.indexOf(fromNode) < 0) {
            toNode.prev.push(fromNode);
        }

        if (data) {
            if (!this.arcs.has(from)) {
                this.arcs.set(from, new Map())
            }
            this.arcs.get(from).set(to, data);
        }

        return this;
    }

    /**
     * get arc data of a arc
     */
    getArc(from: string, to: string): A {
        let m = this.arcs.get(from);
        return m != null ? m.get(to) : null;
    }

    /**
     * remove a node
     */
    removeNode(name: string): this {
        let n = this.nodes.get(name);
        if (n != null) {
            for (let m of n.prev) {
                removeItem(m.next, n);
            }
            for (let m of n.next) {
                removeItem(m.prev, n);
            }
            this.nodes.delete(name);
        }
        return this;
    }

    /**
     * previous nodes of this node
     */
    prev(name: string): string[] {
        if (!this.nodes.has(name)) throw new Error("illegal node name " + name);
        return this.nodes.get(name).prev.map(n => n.name);
    }

    /**
     * next nodes of this node
     */
    next(name: string): string[] {
        if (!this.nodes.has(name)) throw new Error("illegal node name " + name);
        return this.nodes.get(name).next.map(n => n.name);
    }

    /**
     * remove arc between from and to
     */
    removeArc(from: string, to: string): this {
        let fromNode, toNode;
        if (this.nodes.has(from) && this.nodes.has(to)) {
            fromNode = this.nodes.get(from);
            toNode = this.nodes.get(to);
            removeItem(fromNode.next, toNode);
            removeItem(toNode.prev, fromNode);
        }
        return this;
    }

    fork(): Graph<T, A> {
        let g = new Graph<T, A>();
        for (let n of this.nodes.values()) {
            g.node(n.name, n.data);
        }
        for (let n of this.nodes.values()) {
            for (let m of n.next) {
                g.arc(n.name, m.name);
            }
        }
        return g;
    }

    topology(): string[] {
        let g = this.fork();
        let open = [];
        open.push(...g.nodes.values());
        let result = [];
        while (open.length !== 0) {
            let node = null;
            for (let n of open) {
                if (n.prev.length === 0) {
                    node = n;
                    break;
                }
            }
            if (node == null) {
                throw new Error("circle find in graph " + open.map(n => n.name));
            }
            for (let n of node.next) {
                removeItem(n.prev, node);
            }
            removeItem(open, node);
            result.push(node.name);
        }
        return result;
    }

    reverse(): Graph<T, A> {
        let g = new Graph<T, A>();
        for (let n of this.nodes.values()) {
            g.node(n.name, n.data);
            for (let m of n.next) {
                g.arc(m.name, n.name);
            }
        }

        return g;
    }

    /**
     * travel to all directly / indirectly previous nodes of those nodes which are the directly or indirectly next nodes of the starter node (includes the starter node).
     * @param starter the starter node
     * @param visitor apply this lambda to all the visited nodes
     */
    travelForest(starter: string, visitor: (s: TravelingStep<T, A>) => boolean) {
        let close = new Set<string>();
        this.travel(this.nodes.get(starter), Direction.forward, new Set<string>(), s1 => {
            if (visitor(TravelingStep.unwrap(s1))) {
                this.travel(s1.node, Direction.backward, close, s2 => {
                    if (s1.node === s2.node) {
                        return true;
                    }
                    return visitor(TravelingStep.unwrap(s2));
                });
                return true;
            }
            return false;
        });
    }

    /**
     * @param starter the starter node
     * @param visitor apply this lambda to all the visited nodes
     */
    travelForward(starter: string, visitor: (s: TravelingStep<T, A>) => boolean) {
        this.travel(this.nodes.get(starter), Direction.forward, new Set(), s => visitor(TravelingStep.unwrap(s)));
    }

    /**
     * @param starter the starter node
     * @param visitor apply this lambda to all the visited nodes
     */
    travelBackward(starter: string, visitor: (s: TravelingStep<T, A>) => boolean) {
        this.travel(this.nodes.get(starter), Direction.backward, new Set(), s => visitor(TravelingStep.unwrap(s)));
    }
    /**
     * @param {Node} starter the starter node
     * @param {string} direction
     * @param {Set<String>} close
     * @param {function(TravelingStep):boolean} visitor apply this lambda to all the visited nodes
     */
    private travel(starter: Node<T>, direction: string, close: Set<string>, visitor: (s: TravelingStep<Node<T>, A>) => boolean) {
        let open = [];
        open.push(new TravelingStep(starter, null, null, null));
        while (open.length !== 0) {
            let step = open.pop();

            if (!close.add(step.node.name)) {
                continue;
            }
            if (!visitor(step)) {
                continue;
            }
            let list = direction === Direction.forward ? step.node.next : step.node.prev;
            for (let i = list.length - 1; i >= 0; i--) {
                let n = list[i];
                let arc = direction === Direction.forward ? this.getArc(step.node.name, n.name) : this.getArc(n.name, step.node.name);
                open.push(new TravelingStep(n, step.node, direction, arc));
            }
        }
    }

    /**
     * get all nodes which have no prev nodes
     */
    starters(): string[] {
        let ns = [];
        for (let n of this.nodes.values()) {
            if (n.prev.length === 0) {
                ns.push(n.name);
            }
        }
        return ns;
    }
}

const Direction = {
    forward: "forward",
    backward: "backward"
};

class TravelingStep<N, A> {
    constructor(public node: N, public from: N, public direction: string, public arc: A) {
        this.node = node;
        this.from = from;
        this.direction = direction;
        this.arc = arc;
    }

    static unwrap<N, A>(step: TravelingStep<Node<N>, A>) {
        return new TravelingStep(step.node.data, step.from != null ? step.from.data : null, step.direction, step.arc);
    }
}