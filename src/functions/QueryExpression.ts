type Matcher = (key: string, target: string) => boolean;
const DEFAULT_MATCHER: Matcher = (key, target) => key === target;

import antlr4 from 'antlr4';
import {QueryExpressionLexer} from './QueryExpressionLexer.js';
import {QueryExpressionParser} from './QueryExpressionParser.js';

export abstract class Node {
    abstract getText(): string;

    getTextWithBrace(withBrace: boolean): string {
        return withBrace ? "(" + this.getText() + ")" : this.getText();
    }

    abstract match(target: string): boolean;
    abstract match(target: string, matcher: Matcher): boolean;

    abstract includes(another: Node): boolean;
    abstract includes(another: Node, matcher: Matcher): boolean;

    toString(): string {
        return this.getText();
    }

    abstract equals(other: Node);
}

export class Or extends Node {
    readonly left: Node;
    readonly right: Node;

    constructor(left: Node, right: Node) {
        super();
        this.left = left;
        this.right = right;
    }

    getText(): string {
        return this.left.getText() + " : " + this.right.getText();
    }

    match(target: string, matcher: Matcher = DEFAULT_MATCHER): boolean {
        return this.left.match(target, matcher) || this.right.match(target, matcher);
    }

    includes(another: Node, matcher: Matcher = DEFAULT_MATCHER): boolean {
        if (another instanceof Or) {
            return this.includes(another.left, matcher) && this.includes(another.right, matcher);
        } else {
            return this.left.includes(another, matcher) || this.right.includes(another, matcher);
        }
    }

    equals(other: Node) {
        if (other instanceof Or) {
            return this.left.equals(other.left) && this.right.equals(other.right)
                || this.left.equals(other.right) && this.right.equals(other.left);
        } else {
            return this.left.equals(other) && this.right.equals(other);
        }
    }
}

export class And extends Node {
    readonly left: Node;
    readonly right: Node;

    constructor(left: Node, right: Node) {
        super();
        this.left = left;
        this.right = right;
    }

    getText(): string {
        return this.left.getTextWithBrace(this.left instanceof Or) +
            " & " +
            this.right.getTextWithBrace(this.right instanceof Or);
    }

    match(target: string, matcher: Matcher = DEFAULT_MATCHER): boolean {
        return this.left.match(target, matcher) && this.right.match(target, matcher);
    }

    includes(another: Node, matcher: Matcher = DEFAULT_MATCHER): boolean {
        if (another instanceof And) {
            return this.includes(another.left, matcher) || this.includes(another.right, matcher);
        } else {
            return this.left.includes(another, matcher) && this.right.includes(another, matcher);
        }
    }

    equals(other: Node) {
        if (other instanceof And) {
            return this.left.equals(other.left) && this.right.equals(other.right)
                || this.left.equals(other.right) && this.right.equals(other.left);
        } else {
            return this.left.equals(other) && this.right.equals(other);
        }
    }
}

export class Not extends Node {
    private readonly expr: Node;

    constructor(expr: Node) {
        super();
        this.expr = expr;
    }

    getText(): string {
        return "!" + this.expr.getTextWithBrace(this.expr instanceof Or || this.expr instanceof And);
    }

    match(target: string, matcher: Matcher = DEFAULT_MATCHER): boolean {
        return !this.expr.match(target, matcher);
    }

    includes(another: Node, matcher: Matcher = DEFAULT_MATCHER): boolean {
        if (another instanceof Not) {
            return another.expr.includes(this.expr, matcher);
        } else {
            return false;
        }
    }

    equals(other: Node) {
        if (other instanceof Not) {
            return this.expr.equals(other.expr);
        }

        if (other instanceof Or) {
            return this.equals(other.left) && this.equals(other.right);
        }

        if (other instanceof And) {
            return this.equals(other.left) && this.equals(other.right);
        }

        return false;
    }
}

abstract class Term extends Node {
    readonly key: string;

    protected constructor(key: string) {
        super();
        this.key = key;
    }

    getText(): string {
        return this.key;
    }

    includes(another: Node, matcher: Matcher = DEFAULT_MATCHER): boolean {
        if (another instanceof Or) {
            return this.includes(another.left, matcher) && this.includes(another.right, matcher);
        }

        if (another instanceof And) {
            return this.includes(another.left, matcher) || this.includes(another.right, matcher);
        }

        if (another instanceof Term) {
            return this.includesTerm(another, matcher);
        }

        return false;
    }

    abstract includesTerm(another: Term, matcher: Matcher): boolean;

    abstract equalsTerm(other: Term);

    equals(other: Node) {
        if (other instanceof Or) {
            return this.equals(other.left) && this.equals(other.right);
        }

        if (other instanceof And) {
            return this.equals(other.left) && this.equals(other.right);
        }

        if (other instanceof Term) {
            return this.equalsTerm(other);
        }

        return false;
    }
}

class Simple extends Term {

    constructor(text: string) {
        super(text.trim());
    }

    match(target: string, matcher: Matcher = DEFAULT_MATCHER): boolean {
        return matcher(this.key, target);
    }

    includesTerm(another: Term, matcher: Matcher): boolean {
        if (another instanceof Simple) {
            return matcher(this.key, another.key);
        } else {
            return false;
        }
    }

    equalsTerm(other: Term): any | boolean {
        return other instanceof Simple && this.key === other.key;
    }
}

class Pattern extends Term {

    private readonly parts: string[];

    constructor(text: string) {
        super(text.trim());
        this.parts = this.key.split('*').filter(s => s !== "");
    }

    match(target: string, matcher: Matcher = DEFAULT_MATCHER): boolean {
            if (this.parts.length === 0) {
                return true;
            }

            if (!this.key.startsWith("*") && !target.startsWith(this.parts[0])) {
                return false;
            }

            if (!this.key.endsWith("*") && !target.endsWith(this.parts[this.parts.length - 1])) {
                return false;
            }

            let j = 0;
            for (let part of this.parts) {
                j = target.indexOf(part, j);
                if (j < 0) {
                    return false;
                }
                j += part.length;
            }

            return true;
    }

    includesTerm(another: Term, matcher: Matcher): boolean {
            if (another instanceof Simple) {
                return this.match(another.key, matcher);
            }

            if (another instanceof Pattern) {
                if (another.key.startsWith("*") && !this.key.startsWith("*")) {
                    return false;
                }

                if (another.key.endsWith("*") && !this.key.endsWith("*")) {
                    return false;
                }

                let j = 0, k = 0;
                for (let part of this.parts) {
                    let found = false;
                    for (; j < another.parts.length; j++) {
                        let target = another.parts[j];
                        let n = target.indexOf(part, k);
                        if (n >= 0) {
                            found = true;
                            k = n + part.length;
                            break;
                        } else {
                            k = 0;
                        }
                    }
                    if (!found) {
                        return false;
                    }
                }

                return true;
            }

            return false;
    }

    equalsTerm(other: Term) {
        return other instanceof Pattern && this.key === other.key;
    }
}

function parseContext(context): Node {
    checkParseError(context.children);
    if (context instanceof QueryExpressionParser.OrContext) {
        return new Or(parseContext(context.left), parseContext(context.right));
    }
    if (context instanceof QueryExpressionParser.AndContext) {
        return new And(parseContext(context.left), parseContext(context.right));
    }
    if (context instanceof QueryExpressionParser.NotContext) {
        return new Not(parseContext(context.expr));
    }
    if (context instanceof QueryExpressionParser.ParenContext) {
        return parseContext(context.expr);
    }
    if (context instanceof QueryExpressionParser.TermContext) {
        let token = context.term;
        let text = token.text;
        if (text.includes('*')) {
            return new Pattern(text);
        } else {
            return new Simple(text);
        }
    }
    if (context.exception) {
        throw context.exception;
    }
    throw new Error("invalid context type: " + context);
}

function checkParseError(trees) {
    for (let tree of trees) {
        if (tree.isErrorNode && tree.isErrorNode()) {
            throw new Error(tree.toString());
        }
    }
}

export function parse(query: string): Node {
    let lexer = new QueryExpressionLexer(new antlr4.InputStream(query));
    let parser = new QueryExpressionParser(new antlr4.CommonTokenStream(lexer));
    let program = parser.program();
    checkParseError(program.children);
    return parseContext(program.expr);
}