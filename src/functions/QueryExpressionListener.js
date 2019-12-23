// Generated from com/yit/deploy/core/algorithm/QueryExpression.g4 by ANTLR 4.5
// jshint ignore: start
var antlr4 = require('antlr4/index');

// This class defines a complete listener for a parse tree produced by QueryExpressionParser.
function QueryExpressionListener() {
	antlr4.tree.ParseTreeListener.call(this);
	return this;
}

QueryExpressionListener.prototype = Object.create(antlr4.tree.ParseTreeListener.prototype);
QueryExpressionListener.prototype.constructor = QueryExpressionListener;

// Enter a parse tree produced by QueryExpressionParser#program.
QueryExpressionListener.prototype.enterProgram = function(ctx) {
};

// Exit a parse tree produced by QueryExpressionParser#program.
QueryExpressionListener.prototype.exitProgram = function(ctx) {
};


// Enter a parse tree produced by QueryExpressionParser#not.
QueryExpressionListener.prototype.enterNot = function(ctx) {
};

// Exit a parse tree produced by QueryExpressionParser#not.
QueryExpressionListener.prototype.exitNot = function(ctx) {
};


// Enter a parse tree produced by QueryExpressionParser#paren.
QueryExpressionListener.prototype.enterParen = function(ctx) {
};

// Exit a parse tree produced by QueryExpressionParser#paren.
QueryExpressionListener.prototype.exitParen = function(ctx) {
};


// Enter a parse tree produced by QueryExpressionParser#or.
QueryExpressionListener.prototype.enterOr = function(ctx) {
};

// Exit a parse tree produced by QueryExpressionParser#or.
QueryExpressionListener.prototype.exitOr = function(ctx) {
};


// Enter a parse tree produced by QueryExpressionParser#and.
QueryExpressionListener.prototype.enterAnd = function(ctx) {
};

// Exit a parse tree produced by QueryExpressionParser#and.
QueryExpressionListener.prototype.exitAnd = function(ctx) {
};


// Enter a parse tree produced by QueryExpressionParser#term.
QueryExpressionListener.prototype.enterTerm = function(ctx) {
};

// Exit a parse tree produced by QueryExpressionParser#term.
QueryExpressionListener.prototype.exitTerm = function(ctx) {
};



exports.QueryExpressionListener = QueryExpressionListener;