function getClosureBody(closureText) {
    let body = closureText.trim();
    if (body.startsWith('{')) {
        body = body.substring(1);
    } else {
        console.warn("closure text does not starts with {");
    }
    if (body.endsWith('}')) {
        body = body.substring(0, body.length - 1);
    } else {
        console.warn("closure text " + body + " does not ends with }");
    }

    let lines = body.split('\n');
    while (lines.length > 0) {
        if (lines[0].trim().length === 0) {
            lines.shift(); // remove first empty lines
        } else {
            break;
        }
    }
    while (lines.length > 0) {
        if (lines[lines.length - 1].trim().length === 0) {
            lines.pop(); // remove last empty lines
        } else {
            break;
        }
    }

    if (lines.length === 0) {
        return "";
    } else if (lines.length === 1) {
        return lines[0].trim();
    }

    let indent = 0;
    for (let j = 0; j < lines[0].length; j++) {
        if (lines[0][j] === ' ') {
            indent++;
        } else if (lines[0][j] === '\t') {
            indent += 4;
        } else {
            break;
        }
    }

    if (indent > 0) {
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i], j = 0;
            while (j < indent && j < line.length) {
                if (line[j] === ' ') {
                    j++;
                } else if (line[j] === '\t') {
                    j += 4;
                } else {
                    break;
                }
            }
            if (j > 0) {
                if (j > line.length) {
                    lines[i] = "";
                } else {
                    lines[i] = line.substring(j);
                }
            }
        }
    }

    return lines.join('\n');
}

export class Closure {
    groovy: string;
    private _body: string;

    constructor({groovy = "{}"}) {
        this.groovy = groovy;
    }

    get body(): string {
        if (!this._body) {
            this._body = getClosureBody(this.groovy);
        }
        return this._body;
    }
}