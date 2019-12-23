// Generated from com/yit/deploy/core/algorithm/QueryExpression.g4 by ANTLR 4.5
// jshint ignore: start
var antlr4 = require('antlr4/index');


var serializedATN = ["\3\u0430\ud6d1\u8206\uad2d\u4417\uaef1\u8d80\uaadd",
    "\2\t\'\b\1\4\2\t\2\4\3\t\3\4\4\t\4\4\5\t\5\4\6\t\6\4\7\t\7\4\b\t\b\3",
    "\2\3\2\3\3\3\3\3\4\3\4\3\5\3\5\3\6\3\6\3\7\6\7\35\n\7\r\7\16\7\36\3",
    "\b\6\b\"\n\b\r\b\16\b#\3\b\3\b\2\2\t\3\3\5\4\7\5\t\6\13\7\r\b\17\t\3",
    "\2\4\t\2,,/\60\62;C\\^^aac|\5\2\13\f\17\17\"\"(\2\3\3\2\2\2\2\5\3\2",
    "\2\2\2\7\3\2\2\2\2\t\3\2\2\2\2\13\3\2\2\2\2\r\3\2\2\2\2\17\3\2\2\2\3",
    "\21\3\2\2\2\5\23\3\2\2\2\7\25\3\2\2\2\t\27\3\2\2\2\13\31\3\2\2\2\r\34",
    "\3\2\2\2\17!\3\2\2\2\21\22\7*\2\2\22\4\3\2\2\2\23\24\7+\2\2\24\6\3\2",
    "\2\2\25\26\7(\2\2\26\b\3\2\2\2\27\30\7<\2\2\30\n\3\2\2\2\31\32\7#\2",
    "\2\32\f\3\2\2\2\33\35\t\2\2\2\34\33\3\2\2\2\35\36\3\2\2\2\36\34\3\2",
    "\2\2\36\37\3\2\2\2\37\16\3\2\2\2 \"\t\3\2\2! \3\2\2\2\"#\3\2\2\2#!\3",
    "\2\2\2#$\3\2\2\2$%\3\2\2\2%&\b\b\2\2&\20\3\2\2\2\5\2\36#\3\b\2\2"].join("");


var atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

var decisionsToDFA = atn.decisionToState.map( function(ds, index) { return new antlr4.dfa.DFA(ds, index); });

function QueryExpressionLexer(input) {
	antlr4.Lexer.call(this, input);
    this._interp = new antlr4.atn.LexerATNSimulator(this, atn, decisionsToDFA, new antlr4.PredictionContextCache());
    return this;
}

QueryExpressionLexer.prototype = Object.create(antlr4.Lexer.prototype);
QueryExpressionLexer.prototype.constructor = QueryExpressionLexer;

QueryExpressionLexer.EOF = antlr4.Token.EOF;
QueryExpressionLexer.LPAREN = 1;
QueryExpressionLexer.RPAREN = 2;
QueryExpressionLexer.AND = 3;
QueryExpressionLexer.OR = 4;
QueryExpressionLexer.NOT = 5;
QueryExpressionLexer.TERM = 6;
QueryExpressionLexer.WS = 7;


QueryExpressionLexer.modeNames = [ "DEFAULT_MODE" ];

QueryExpressionLexer.literalNames = [ 'null', "'('", "')'", "'&'", "':'", 
                                      "'!'" ];

QueryExpressionLexer.symbolicNames = [ 'null', "LPAREN", "RPAREN", "AND", 
                                       "OR", "NOT", "TERM", "WS" ];

QueryExpressionLexer.ruleNames = [ "LPAREN", "RPAREN", "AND", "OR", "NOT", 
                                   "TERM", "WS" ];

QueryExpressionLexer.grammarFileName = "QueryExpression.g4";



exports.QueryExpressionLexer = QueryExpressionLexer;

