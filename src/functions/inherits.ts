/**
 * travel all parents of the given object
 */
function travelParents<T>(self: T, parents: (t: T) => Iterable<T>, close: Set<T>, visitor: (t: T) => void) {
    for (let p of parents(self)) {
        if (!close.has(p)) {
            close.add(p);
            travelParents(p, parents, close, visitor);
            visitor(p);
        }
    }
}

export function descendingParents<T>(self: T, parents: (t: T) => Iterable<T>) {
    let list = [];
    travelParents(self, parents, new Set(), x => list.push(x));
    return list;
}

/**
 * travel all parents of the given object, and self
 */
export function travelDescending<T>(self: T, parents: (t: T) => Iterable<T>, visitor: (t: T) => void) {
    let close = new Set();
    close.add(self); // avoid self to be visited in the parents
    travelParents(self, parents, close, visitor);
    visitor(self);
}

export function descending<T>(self: T, parents: (t: T) => Iterable<T>) {
    let list = [];
    let close = new Set();
    close.add(self); // avoid self to be visited in the parents
    travelParents(self, parents, close, x => list.push(x));
    list.push(self);
    return list;
}

export function ascendingParents<T>(self: T, parents: (t: T) => Iterable<T>) {
    return descendingParents(self, parents).reverse();
}

export function ascending<T>(self: T, parents: (t: T) => Iterable<T>) {
    return descending(self, parents).reverse();
}

export function all<T>(self: T, parents: (t: T) => Iterable<T>, test: (t: T) => boolean): boolean {
    for (let t of descending(self, parents)) {
        if (!test(t)) {
            return false;
        }
    }
    return true;
}

export function any<T>(self: T, parents: (t: T) => Iterable<T>, test: (t: T) => boolean): boolean {
    for (let t of ascending(self, parents)) {
        if (test(t)) {
            return true;
        }
    }
    return false;
}

export function nearestInParents<T, R>(self: T, parents: (t: T) => Iterable<T>, f: (t: T) => R): R {
    for (let t of ascendingParents(self, parents)) {
        let r = f(t);
        if (r != null) {
            return r;
        }
    }
    return null;
}

export function nearest<T, R>(self: T, parents: (t: T) => Iterable<T>, f: (t: T) => R): R {
    for (let t of ascending(self, parents)) {
        let r = f(t);
        if (r != null) {
            return r;
        }
    }
    return null;
}

export function belongsTo<T>(self: T, parents: (t: T) => Iterable<T>, parent: T) {
    if (self === parent) {
        return true;
    }
    for (let t of descending(self, parents)) {
        if (t === parent) {
            return true;
        }
    }
    return false;
}