/**
 * apply the values of a map to a function, and return the generated map
 */
export function mapValues<K, V, R>(map: Map<K, V> | Object, f: (value: V, key: K) => R): Map<K, R> {
    let r = new Map();
    if (map instanceof Map) {
        for (let [k, v] of map) {
            r.set(k, f(v, k));
        }
    } else {
        for (let k in map) {
            if (map.hasOwnProperty(k)) {
                r.set(k, f(map[k], k as any));
            }
        }
    }

    return r;
}

export function map<T, R>(iterable: Iterable<T>, f: (t: T) => R): R[] {
    let r = [];
    for (let x of iterable) {
        r.push(f(x));
    }
    return r;
}

export function collectSet<T, R>(iter: Iterable<T>, f: (t: T) => Iterable<R>): Set<R> {
    let set = new Set<R>();
    for (let s of iter) {
        for (let x of f(s)) {
            set.add(x);
        }
    }
    return set;
}

export function collectMap<T, K, V>(iter: Iterable<T>, f: (t: T) => Map<K, V>): Map<K, V> {
    let map = new Map();
    for (let s of iter) {
        for (let [k, v] of f(s)) {
            map.set(k, v);
        }
    }
    return map;
}

/**
 * remove item from array
 * @param {[]} a
 * @param x
 */
export function removeItem<T>(a: T[], x: T) {
    for (let i = 0; i < a.length; i++) {
        if (a[i] === x) {
            a.splice(i, 1);
        }
    }
}

/**
 * merge map
 * @param {Map} map1
 * @param {Map} map2
 * @param {function(*):*}creator
 */
export function mergeMap<K, V extends {merge?: (value: V) => void}>(map1: Map<K, V>, map2: Map<K, V>, creator: (key: K) => V = () => null) {
    for (let key of map2.keys()) {
        if (!map1.has(key)) {
            map1.set(key, creator(key));
        }
        let value = map1.get(key);
        if (typeof value.merge === "function") {
            value.merge(map2.get(key));
        } else {
            map1.set(key, map2.get(key));
        }
    }
}

/**
 * merge list
 * @param {[]} list1
 * @param {[]} list2
 * @param {function(*):*} clone
 */
export function mergeList<T>(list1: T[], list2: T[], clone: (t: T) => T = x => x) {
    for (let item of list2) {
        if (list1.findIndex(x => x === item) < 0) {
            list1.push(clone(item));
        }
    }
}

/**
 * get the first none null item
 */
export function cascade<T, R>(list: T[], f: (t: T) => R): R {
    for (let x of list) {
        let v = f(x);
        if (v !== null && v !== undefined) {
            return v;
        }
    }
}

export function deepEqual(a: any, b: any): boolean {
    if (a === b) {
        return true;
    }
    if (a === null || b === null) {
        return false;
    }
    if (Object.is(a, b)) {
        return true;
    }
    if (typeof a !== typeof b) {
        return false;
    }
    if (a instanceof Map && b instanceof Map) {
        if (a.size !== b.size) {
            return false;
        }
        for (let key of a.keys()) {
            if (!deepEqual(a.get(key), b.get(key))) {
                return false;
            }
        }
        return true;
    }
    if (a instanceof Array && b instanceof Array) {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }

    // fallback to object compare
    for (let p in a) {
        if (a.hasOwnProperty(p)) {
            if (!b.hasOwnProperty(p)) {
                return false;
            }
            if (!deepEqual(a[p], b[p])) {
                return false;
            }
        }
    }
    for (let p in b) {
        if (b.hasOwnProperty(p) && !a.hasOwnProperty(p)) {
            return false;
        }
    }
    return true;
}

/**
 * return the intersect of two given collections
 */
export function intersect<T>(a: T[], b: T[]): T[] {
    let c = [];
    for (let x of a) {
        for (let y of b) {
            if (x === y) {
                c.push(x);
                break;
            }
        }
    }
    return c;
}

/**
 * if list a equals to list be without considering its order
 */
export function listEqualsIgnoreOrder<T>(a: T[], b: T[]): boolean {
    if (a === b) {
        return true;
    }
    if (!!a === !b) {
        return false; // one is null and the other is not
    }
    if (a.length !== b.length) {
        return false;
    }
    for (let x of a) {
        if (!b.includes(x)) {
            return false;
        }
    }
    return true;
}

/**
 * return if all elements are contained in array a
 */
export function containsAll<T>(a: T[], b: T[]): boolean {
    for (let x of b) {
        if (a.indexOf(x) < 0) {
            return false;
        }
    }
    return true;
}

/**
 * return if the element is contained in array a
 */
export function contains<T>(a: T[], x: T): boolean {
    return a.indexOf(x) >= 0;
}

export function uniqueAdd<T>(a: T[], b: T[]): void {
    for (let x of b) {
        if (!a.includes(x)) {
            a.push(x);
        }
    }
}

export function collectList<T, R>(a: Iterable<T>, f: (t: T) => Iterable<R>): R[] {
    let ls = [];
    for (let x of a) {
        for (let y of f(x)) {
            ls.push(y);
        }
    }
    return ls;
}

export function find(list, predicate) {
    for (let x of list) {
        if (predicate(x)) {
            return x;
        }
    }
}

export function findIndexOf(list, predicate) {
    for (let i = 0; i < list.length; i++) {
        if (predicate(list[i])) {
            return i;
        }
    }
    return -1;
}

export function countIf<T>(list: Iterable<T>, predicate: (t: T) => boolean): number {
    let c = 0;
    for (let x of list) {
        if (predicate(x)) {
            c++;
        }
    }
    return c;
}

export function collectUniqueList<T, R>(list: T[], f: (t: T) => Iterable<R>): R[] {
    let ls = [];
    for (let x of list) {
        for (let y of f(x)) {
            if (ls.indexOf(y) < 0) {
                ls.push(y);
            }
        }
    }
    return ls;
}

export function unique<T>(list: T[]): T[] {
    let ts = [];
    for (let t of list) {
        if (!ts.includes(t)) {
            ts.push(t);
        }
    }
    return ts;
}

export function spaceShip(x, y): number {
    return x < y ? -1 : x > y ? 1 : 0;
}

export function compare<T, R>(f: (t: T) => R): (a: T, b: T) => number {
    return (a: T, b: T) => {
        let x = f(a), y = f(b);
        return x === y ? 0 : x < y ? -1 : 1;
    }
}

export function groupBy<T, K>(list: Iterable<T>, f: (t: T) => K): Map<K, T[]> {
    let m = new Map<K, T[]>();
    for (let t of list) {
        let key = f(t);
        let ls = m.get(key);
        if (!ls) {
            m.set(key, ls = []);
        }
        ls.push(t);
    }
    return m;
}

export function firstDefined<T>(a: T | undefined, b: T | undefined): T | undefined {
    return a === undefined ? b : a;
}

export function copyDefinedProperties(a, b): void {
    for (let p in b) {
        if (a.hasOwnProperty(p) && b.hasOwnProperty(p)) {
            let v = b[p];
            if (v !== undefined) {
                a[p] = v;
            }
        }
    }
}

export function every<T>(a: T[], predicate: (T) => boolean): boolean {
    for (let x of a) {
        if (!predicate(x)) {
            return false;
        }
    }
    return true;
}

export function exists<T>(a: T[], predicate: (T) => boolean): boolean {
    for (let x of a) {
        if (predicate(x)) {
            return true;
        }
    }
    return false;
}