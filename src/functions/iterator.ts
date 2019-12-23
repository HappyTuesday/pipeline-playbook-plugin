export class SimpleIterator<T> implements IterableIterator<T> {

    private readonly producer: () => T | undefined;

    /**
     * create a simple iterator by a producer function
     *
     * @param producer  return an iterator/iterable which will yield all values returned from the given producer,
     *                  until it returns a undefined
     */
    constructor(producer: () => T | undefined) {
        this.producer = producer;
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this;
    }

    next(value?: any): IteratorResult<T> {
        let r = this.producer();
        return {
            value: r,
            done: r === undefined
        }
    }

    return(value?: any): IteratorResult<T> {
        return {value: value, done: true}
    }

    throw(e?: any): IteratorResult<T> {
        throw new Error("unsupported operation");
    }

    filter(f: (item: T, index: number) => boolean): SimpleIterator<T> {
        let i = 0;
        return new SimpleIterator(() => {
            while (true) {
                let {value, done} = this.next();
                if (done) {
                    return undefined;
                } else if (f(value, i++)) {
                    return value;
                }
            }
        })
    }

    map<R>(f: (item: T, index: number) => R): SimpleIterator<R> {
        let i = 0;
        return new SimpleIterator(() => {
            let {value, done} = this.next();
            if (done) {
                return undefined;
            } else {
                return f(value, i++);
            }
        })
    }

    any(f: (item: T, index: number) => boolean): boolean {
        let i = 0;
        while (true) {
            let {value, done} = this.next();
            if (done) {
                return false;
            }
            if (f(value, i++)) {
                return true;
            }
        }
    }

    forEach(f: (item: T, index: number) => void): void {
        let i = 0;
        while (true) {
            let {value, done} = this.next();
            if (done) {
                return;
            }
            f(value, i++);
        }
    }

    get(index: number): T {
        let i = 0;
        while (true) {
            let {value, done} = this.next();
            if (done) {
                return undefined;
            }
            if (i++ === index) {
                return value;
            }
        }
    }

    indexOf(t: T): number {
        let i = 0;
        while (true) {
            let {value, done} = this.next();
            if (done) {
                return i;
            }
            if (value === t) {
                return i;
            }
            i++;
        }
    }

    lastIndexOf(t: T): number {
        let i = 0, j= -1;
        while (true) {
            let {value, done} = this.next();
            if (done) {
                return j;
            }
            if (value === t) {
                j = i;
            }
            i++;
        }
    }

    contains(t: T): boolean {
        while (true) {
            let {value, done} = this.next();
            if (done) {
                return false;
            }
            if (value === t) {
                return true;
            }
        }
    }

    toArray() {
        let a = [];
        while (true) {
            let {value, done} = this.next();
            if (done) {
                return a;
            }
            a.push(value);
        }
    }

    get length(): number {
        let c = 0;
        while (true) {
            let {done} = this.next();
            if (done) {
                return c;
            }
            c++;
        }
    }

    static empty<T>(): SimpleIterator<T> {
        return SimpleIterator.EmptyIterator;
    }

    private static readonly EmptyIterator = new SimpleIterator(() => undefined);

    static singleton<T>(value: T): SimpleIterator<T> {
        let first = true;
        return new SimpleIterator(() => {
            if (first) {
                first = false;
                return value;
            }
        })
    }

    static from<T>(iterator: Iterator<T> | Iterable<T>): SimpleIterator<T> {
        if (iterator instanceof SimpleIterator) {
            return iterator;
        }

        let iter = iterator[Symbol.iterator] ? iterator[Symbol.iterator]() : iterator;

        return new SimpleIterator<T>(() => {
            let {value, done} = iter.next();
            if (done) {
                return undefined;
            }
            return value;
        })
    }
}