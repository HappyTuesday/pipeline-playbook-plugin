// Generated from com/yit/deploy/core/algorithm/QueryExpression.g4 by ANTLR 4.5
// jshint ignore: start
var antlr4 = require('antlr4/index');
var QueryExpressionListener = require('./QueryExpressionListener').QueryExpressionListener;
var grammarFileName = "QueryExpression.g4";

var serializedATN = ["\3\u0430\ud6d1\u8206\uad2d\u4417\uaef1\u8d80\uaadd",
    "\3\t\37\4\2\t\2\4\3\t\3\3\2\3\2\3\2\3\3\3\3\3\3\3\3\3\3\3\3\3\3\3\3",
    "\5\3\22\n\3\3\3\3\3\3\3\3\3\3\3\3\3\7\3\32\n\3\f\3\16\3\35\13\3\3\3",
    "\2\3\4\4\2\4\2\2 \2\6\3\2\2\2\4\21\3\2\2\2\6\7\5\4\3\2\7\b\7\2\2\3\b",
    "\3\3\2\2\2\t\n\b\3\1\2\n\13\7\7\2\2\13\22\5\4\3\6\f\22\7\b\2\2\r\16",
    "\7\3\2\2\16\17\5\4\3\2\17\20\7\4\2\2\20\22\3\2\2\2\21\t\3\2\2\2\21\f",
    "\3\2\2\2\21\r\3\2\2\2\22\33\3\2\2\2\23\24\f\4\2\2\24\25\7\5\2\2\25\32",
    "\5\4\3\5\26\27\f\3\2\2\27\30\7\6\2\2\30\32\5\4\3\4\31\23\3\2\2\2\31",
    "\26\3\2\2\2\32\35\3\2\2\2\33\31\3\2\2\2\33\34\3\2\2\2\34\5\3\2\2\2\35",
    "\33\3\2\2\2\5\21\31\33"].join("");


var atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

var decisionsToDFA = atn.decisionToState.map( function(ds, index) { return new antlr4.dfa.DFA(ds, index); });

var sharedContextCache = new antlr4.PredictionContextCache();

var literalNames = [ 'null', "'('", "')'", "'&'", "':'", "'!'" ];

var symbolicNames = [ 'null', "LPAREN", "RPAREN", "AND", "OR", "NOT", "TERM", 
                      "WS" ];

var ruleNames =  [ "program", "expression" ];

function QueryExpressionParser (input) {
	antlr4.Parser.call(this, input);
    this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
    this.ruleNames = ruleNames;
    this.literalNames = literalNames;
    this.symbolicNames = symbolicNames;
    return this;
}

QueryExpressionParser.prototype = Object.create(antlr4.Parser.prototype);
QueryExpressionParser.prototype.constructor = QueryExpressionParser;

Object.defineProperty(QueryExpressionParser.prototype, "atn", {
	get : function() {
		return atn;
	}
});

QueryExpressionParser.EOF = antlr4.Token.EOF;
QueryExpressionParser.LPAREN = 1;
QueryExpressionParser.RPAREN = 2;
QueryExpressionParser.AND = 3;
QueryExpressionParser.OR = 4;
QueryExpressionParser.NOT = 5;
QueryExpressionParser.TERM = 6;
QueryExpressionParser.WS = 7;

QueryExpressionParser.RULE_program = 0;
QueryExpressionParser.RULE_expression = 1;

function ProgramContext(parser, parent, invokingState) {
	if(parent===undefined) {
	    parent = null;
	}
	if(invokingState===undefined || invokingState===null) {
		invokingState = -1;
	}
	antlr4.ParserRuleContext.call(this, parent, invokingState);
    this.parser = parser;
    this.ruleIndex = QueryExpressionParser.RULE_program;
    this.expr = null; // ExpressionContext
    return this;
}

ProgramContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
ProgramContext.prototype.constructor = ProgramContext;

ProgramContext.prototype.EOF = function() {
    return this.getToken(QueryExpressionParser.EOF, 0);
};

ProgramContext.prototype.expression = function() {
    return this.getTypedRuleContext(ExpressionContext,0);
};

ProgramContext.prototype.enterRule = function(listener) {
    if(listener instanceof QueryExpressionListener ) {
        listener.enterProgram(this);
	}
};

ProgramContext.prototype.exitRule = function(listener) {
    if(listener instanceof QueryExpressionListener ) {
        listener.exitProgram(this);
	}
};




QueryExpressionParser.ProgramContext = ProgramContext;

QueryExpressionParser.prototype.program = function() {

    var localctx = new ProgramContext(this, this._ctx, this.state);
    this.enterRule(localctx, 0, QueryExpressionParser.RULE_program);
    try {
        this.enterOuterAlt(localctx, 1);
        this.state = 4;
        localctx.expr = this.expression(0);
        this.state = 5;
        this.match(QueryExpressionParser.EOF);
    } catch (re) {
    	if(re instanceof antlr4.error.RecognitionException) {
	        localctx.exception = re;
	        this._errHandler.reportError(this, re);
	        this._errHandler.recover(this, re);
	    } else {
	    	throw re;
	    }
    } finally {
        this.exitRule();
    }
    return localctx;
};

function ExpressionContext(parser, parent, invokingState) {
	if(parent===undefined) {
	    parent = null;
	}
	if(invokingState===undefined || invokingState===null) {
		invokingState = -1;
	}
	antlr4.ParserRuleContext.call(this, parent, invokingState);
    this.parser = parser;
    this.ruleIndex = QueryExpressionParser.RULE_expression;
    return this;
}

ExpressionContext.prototype = Object.create(antlr4.ParserRuleContext.prototype);
ExpressionContext.prototype.constructor = ExpressionContext;


 
ExpressionContext.prototype.copyFrom = function(ctx) {
    antlr4.ParserRuleContext.prototype.copyFrom.call(this, ctx);
};

function NotContext(parser, ctx) {
	ExpressionContext.call(this, parser);
    this.op = null; // Token;
    this.expr = null; // ExpressionContext;
    ExpressionContext.prototype.copyFrom.call(this, ctx);
    return this;
}

NotContext.prototype = Object.create(ExpressionContext.prototype);
NotContext.prototype.constructor = NotContext;

QueryExpressionParser.NotContext = NotContext;

NotContext.prototype.NOT = function() {
    return this.getToken(QueryExpressionParser.NOT, 0);
};

NotContext.prototype.expression = function() {
    return this.getTypedRuleContext(ExpressionContext,0);
};
NotContext.prototype.enterRule = function(listener) {
    if(listener instanceof QueryExpressionListener ) {
        listener.enterNot(this);
	}
};

NotContext.prototype.exitRule = function(listener) {
    if(listener instanceof QueryExpressionListener ) {
        listener.exitNot(this);
	}
};


function ParenContext(parser, ctx) {
	ExpressionContext.call(this, parser);
    this.expr = null; // ExpressionContext;
    ExpressionContext.prototype.copyFrom.call(this, ctx);
    return this;
}

ParenContext.prototype = Object.create(ExpressionContext.prototype);
ParenContext.prototype.constructor = ParenContext;

QueryExpressionParser.ParenContext = ParenContext;

ParenContext.prototype.LPAREN = function() {
    return this.getToken(QueryExpressionParser.LPAREN, 0);
};

ParenContext.prototype.RPAREN = function() {
    return this.getToken(QueryExpressionParser.RPAREN, 0);
};

ParenContext.prototype.expression = function() {
    return this.getTypedRuleContext(ExpressionContext,0);
};
ParenContext.prototype.enterRule = function(listener) {
    if(listener instanceof QueryExpressionListener ) {
        listener.enterParen(this);
	}
};

ParenContext.prototype.exitRule = function(listener) {
    if(listener instanceof QueryExpressionListener ) {
        listener.exitParen(this);
	}
};


function OrContext(parser, ctx) {
	ExpressionContext.call(this, parser);
    this.left = null; // ExpressionContext;
    this.op = null; // Token;
    this.right = null; // ExpressionContext;
    ExpressionContext.prototype.copyFrom.call(this, ctx);
    return this;
}

OrContext.prototype = Object.create(ExpressionContext.prototype);
OrContext.prototype.constructor = OrContext;

QueryExpressionParser.OrContext = OrContext;

OrContext.prototype.expression = function(i) {
    if(i===undefined) {
        i = null;
    }
    if(i===null) {
        return this.getTypedRuleContexts(ExpressionContext);
    } else {
        return this.getTypedRuleContext(ExpressionContext,i);
    }
};

OrContext.prototype.OR = function() {
    return this.getToken(QueryExpressionParser.OR, 0);
};
OrContext.prototype.enterRule = function(listener) {
    if(listener instanceof QueryExpressionListener ) {
        listener.enterOr(this);
	}
};

OrContext.prototype.exitRule = function(listener) {
    if(listener instanceof QueryExpressionListener ) {
        listener.exitOr(this);
	}
};


function AndContext(parser, ctx) {
	ExpressionContext.call(this, parser);
    this.left = null; // ExpressionContext;
    this.op = null; // Token;
    this.right = null; // ExpressionContext;
    ExpressionContext.prototype.copyFrom.call(this, ctx);
    return this;
}

AndContext.prototype = Object.create(ExpressionContext.prototype);
AndContext.prototype.constructor = AndContext;

QueryExpressionParser.AndContext = AndContext;

AndContext.prototype.expression = function(i) {
    if(i===undefined) {
        i = null;
    }
    if(i===null) {
        return this.getTypedRuleContexts(ExpressionContext);
    } else {
        return this.getTypedRuleContext(ExpressionContext,i);
    }
};

AndContext.prototype.AND = function() {
    return this.getToken(QueryExpressionParser.AND, 0);
};
AndContext.prototype.enterRule = function(listener) {
    if(listener instanceof QueryExpressionListener ) {
        listener.enterAnd(this);
	}
};

AndContext.prototype.exitRule = function(listener) {
    if(listener instanceof QueryExpressionListener ) {
        listener.exitAnd(this);
	}
};


function TermContext(parser, ctx) {
	ExpressionContext.call(this, parser);
    this.term = null; // Token;
    ExpressionContext.prototype.copyFrom.call(this, ctx);
    return this;
}

TermContext.prototype = Object.create(ExpressionContext.prototype);
TermContext.prototype.constructor = TermContext;

QueryExpressionParser.TermContext = TermContext;

TermContext.prototype.TERM = function() {
    return this.getToken(QueryExpressionParser.TERM, 0);
};
TermContext.prototype.enterRule = function(listener) {
    if(listener instanceof QueryExpressionListener ) {
        listener.enterTerm(this);
	}
};

TermContext.prototype.exitRule = function(listener) {
    if(listener instanceof QueryExpressionListener ) {
        listener.exitTerm(this);
	}
};



QueryExpressionParser.prototype.expression = function(_p) {
	if(_p===undefined) {
	    _p = 0;
	}
    var _parentctx = this._ctx;
    var _parentState = this.state;
    var localctx = new ExpressionContext(this, this._ctx, _parentState);
    var _prevctx = localctx;
    var _startState = 2;
    this.enterRecursionRule(localctx, 2, QueryExpressionParser.RULE_expression, _p);
    try {
        this.enterOuterAlt(localctx, 1);
        this.state = 15;
        switch(this._input.LA(1)) {
        case QueryExpressionParser.NOT:
            localctx = new NotContext(this, localctx);
            this._ctx = localctx;
            _prevctx = localctx;

            this.state = 8;
            localctx.op = this.match(QueryExpressionParser.NOT);
            this.state = 9;
            localctx.expr = this.expression(4);
            break;
        case QueryExpressionParser.TERM:
            localctx = new TermContext(this, localctx);
            this._ctx = localctx;
            _prevctx = localctx;
            this.state = 10;
            localctx.term = this.match(QueryExpressionParser.TERM);
            break;
        case QueryExpressionParser.LPAREN:
            localctx = new ParenContext(this, localctx);
            this._ctx = localctx;
            _prevctx = localctx;
            this.state = 11;
            this.match(QueryExpressionParser.LPAREN);
            this.state = 12;
            localctx.expr = this.expression(0);
            this.state = 13;
            this.match(QueryExpressionParser.RPAREN);
            break;
        default:
            throw new antlr4.error.NoViableAltException(this);
        }
        this._ctx.stop = this._input.LT(-1);
        this.state = 25;
        this._errHandler.sync(this);
        var _alt = this._interp.adaptivePredict(this._input,2,this._ctx)
        while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
            if(_alt===1) {
                if(this._parseListeners!==null) {
                    this.triggerExitRuleEvent();
                }
                _prevctx = localctx;
                this.state = 23;
                var la_ = this._interp.adaptivePredict(this._input,1,this._ctx);
                switch(la_) {
                case 1:
                    localctx = new AndContext(this, new ExpressionContext(this, _parentctx, _parentState));
                    localctx.left = _prevctx;
                    this.pushNewRecursionContext(localctx, _startState, QueryExpressionParser.RULE_expression);
                    this.state = 17;
                    if (!( this.precpred(this._ctx, 2))) {
                        throw new antlr4.error.FailedPredicateException(this, "this.precpred(this._ctx, 2)");
                    }
                    this.state = 18;
                    localctx.op = this.match(QueryExpressionParser.AND);
                    this.state = 19;
                    localctx.right = this.expression(3);
                    break;

                case 2:
                    localctx = new OrContext(this, new ExpressionContext(this, _parentctx, _parentState));
                    localctx.left = _prevctx;
                    this.pushNewRecursionContext(localctx, _startState, QueryExpressionParser.RULE_expression);
                    this.state = 20;
                    if (!( this.precpred(this._ctx, 1))) {
                        throw new antlr4.error.FailedPredicateException(this, "this.precpred(this._ctx, 1)");
                    }
                    this.state = 21;
                    localctx.op = this.match(QueryExpressionParser.OR);
                    this.state = 22;
                    localctx.right = this.expression(2);
                    break;

                } 
            }
            this.state = 27;
            this._errHandler.sync(this);
            _alt = this._interp.adaptivePredict(this._input,2,this._ctx);
        }

    } catch( error) {
        if(error instanceof antlr4.error.RecognitionException) {
	        localctx.exception = error;
	        this._errHandler.reportError(this, error);
	        this._errHandler.recover(this, error);
	    } else {
	    	throw error;
	    }
    } finally {
        this.unrollRecursionContexts(_parentctx)
    }
    return localctx;
};


QueryExpressionParser.prototype.sempred = function(localctx, ruleIndex, predIndex) {
	switch(ruleIndex) {
	case 1:
			return this.expression_sempred(localctx, predIndex);
    default:
        throw "No predicate with index:" + ruleIndex;
   }
};

QueryExpressionParser.prototype.expression_sempred = function(localctx, predIndex) {
	switch(predIndex) {
		case 0:
			return this.precpred(this._ctx, 2);
		case 1:
			return this.precpred(this._ctx, 1);
		default:
			throw "No predicate with index:" + predIndex;
	}
};


exports.QueryExpressionParser = QueryExpressionParser;
