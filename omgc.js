/** @preserve (c) 2014 dean@gmail.com http://github.com/deanm/omgc */

// Based on the principles of Top Down Operator Precedence:
//   http://javascript.crockford.com/tdop/tdop.html
//   http://hall.org.ua/halls/wizzard/pdf/Vaughan.Pratt.TDOP.pdf

// The two main components are the lexer and the AST builder.
//   var lexer = new CLexer(string_input);
//   var tree = build_ast(lexer);

var kMaxPrecedence = 20;  // Should be at least 2 greater than largest used precedence.

function invalid_led() { throw "error, invalid led call"; }
function invalid_nud() { throw "error, invalid nud call"; }

function token_op(str, binary_prec, unary_prec, assoc) {
  return {
    token_type: 'op_b',
    op_str: str,
    lprec: binary_prec,
    assoc: assoc,
    led: binary_prec === 0 ? invalid_led :
      function(left, s) {
        this.prec = binary_prec;
        this.left = left;
        this.right = s.expression(binary_prec + (assoc === 'right' ? 0.1 : 0), s);
        return this;
      },
    nud: unary_prec === 0 ? invalid_nud :
      function(s) {
        this.token_type = 'op_u';
        this.prec = unary_prec;
        this.assoc = 'right';  // Unary always right assoc.
        this.left = s.expression(unary_prec, s);
        return this;
      }
  };
}

function token_op_left(str, binary_prec, unary_prec) {
  return token_op(str, binary_prec, unary_prec, 'left');
}

function token_op_right(str, binary_prec, unary_prec) {
  return token_op(str, binary_prec, unary_prec, 'right');
}

function token_num(type, val, suffix) {
  return {
    token_type: 'num',
    num_type: type,
    left: val,
    suffix: suffix,
    led: invalid_led,
    nud: function(s) { return this; }
  };
}

function token_sym(name) {
  return {
    token_type: 'sym',
    left: name,
    led: invalid_led,
    nud: function(s) { return this; }
  };
}

function token_int(val, suffix) { return token_num('int', val, suffix); }
function token_flt(val, suffix) { return token_num('flt', val, suffix); }

// Sort of a binary operator, in the way that when we put it in the AST
// we want it to have a right (type expression) and a left (expression).
// But in terms of parsing it should be processed like a unary.
function token_typecast(typestr) {
  return {
    token_type: 'op_b_typecast',
    prec: 3,
    assoc: 'right',
    led: invalid_led,
    nud: function(s) {
      this.left = token_sym(typestr);
      this.right = s.expression(3.1, s);
      return this;
    }
  };
}

// Take an expression string, tokenizes, and returns an Array of tokens.
// On an error, an exception is thrown.

function c_token_op_left(binary_prec, unary_prec) {
  return function(cc) {
    return token_op_left(cc, binary_prec, unary_prec);
  };
}

function c_token_op_right(binary_prec, unary_prec) {
  return function(cc) {
    return token_op_right(cc, binary_prec, unary_prec);
  };
}

function c_token_post_pre(post_prec, pre_prec) {
  return function(cc) {
    return {
      token_type: 'op_u',
      op_str: cc,
      lprec: post_prec,
      led: function(left, s) {  // suffix (a++).
        this.token_type += '_s';
        this.prec = post_prec,
        this.assoc = 'left';
        this.left = left;
        return this;
      },
      nud: function(s) {        // prefix (++a).
        this.assoc = 'right';
        this.prec = pre_prec;
        this.left = s.expression(3, s);
        return this;
      }
    };
  };
}

var kDummyWhitespaceToken = { };

function c_token_whitespace() {
  return function(c) {
    return kDummyWhitespaceToken;
  };
}

function is_whitespace_token(t) {
  return t === kDummyWhitespaceToken;
}

var kCOperatorTable = {
  " ":   c_token_whitespace(),
  "\t":  c_token_whitespace(),
  "\r":  c_token_whitespace(),
  "\n":  c_token_whitespace(),
  '++':  c_token_post_pre(   1, 3  ),
  '--':  c_token_post_pre(   2, 3  ),
  '.':   c_token_op_left(    2, 0  ),
  '->':  c_token_op_left(    2, 0  ),
  '!':   c_token_op_right(   0, 3  ),
  '~':   c_token_op_right(   0, 3  ),
  '*':   c_token_op_left(    5, 3  ),
  '/':   c_token_op_left(    5, 0  ),
  '%':   c_token_op_left(    5, 0  ),
  '+':   c_token_op_left(    6, 3  ),
  '-':   c_token_op_left(    6, 3  ),
  '<<':  c_token_op_left(    7, 0  ),
  '>>':  c_token_op_left(    7, 0  ),
  '<=':  c_token_op_left(    8, 0  ),
  '>=':  c_token_op_left(    8, 0  ),
  '==':  c_token_op_left(    9, 0  ),
  '!=':  c_token_op_left(    9, 0  ),
  '&':   c_token_op_left(   10, 3  ),
  '^':   c_token_op_left(   11, 0  ),
  '|':   c_token_op_left(   12, 0  ),
  '&&':  c_token_op_left(   13, 0  ),
  '||':  c_token_op_left(   14, 0  ),
  '=':   c_token_op_right(  16, 0  ),
  '+=':  c_token_op_right(  16, 0  ),
  '-=':  c_token_op_right(  16, 0  ),
  '*=':  c_token_op_right(  16, 0  ),
  '/=':  c_token_op_right(  16, 0  ),
  '%=':  c_token_op_right(  16, 0  ),
  '<<=': c_token_op_right(  16, 0  ),
  '>>=': c_token_op_right(  16, 0  ),
  '&=':  c_token_op_right(  16, 0  ),
  '^=':  c_token_op_right(  16, 0  ),
  '|=':  c_token_op_right(  16, 0  ),
  ',':   c_token_op_right(  18, 0  )
};

// 6.4.2.1 Identifiers - General
/** @const */ var kRegexSym = /^[a-zA-Z_][a-zA-Z0-9_]*/;

// 6.4.4.1 Integer constants
// NOTE: We don't need to handle + / -, will be handled by unary operators.
/** @const */ var kRegexIntDec = /^[1-9][0-9]*/;
/** @const */ var kRegexIntOct = /^0[0-7]*/;
/** @const */ var kRegexIntHex = /^0[xX][0-9a-fA-F]+/;
/** @const */ var kRegexIntSuf = /^[uU](?:ll|LL)|^[uU][lL]?|^(?:ll|LL)[uU]?|^[lL][uU]?/;

// 6.4.4.2 Floating constants
// NOTE: Not bothering to support hexadecimal floating constants.
/** @const */ var kRegexFltDec = /^(?:[0-9]*\.[0-9]+|[0-9]+\.)(?:[eE][+-]?[0-9]+)?|^[0-9]+[eE][+-]?[0-9]+/;
/** @const */ var kRegexFltSuf = /^[fFlL]/;

/** @const */ var kNumberLexers = [
  kRegexFltDec, kRegexFltSuf, parseFloat, token_flt,
  kRegexIntHex, kRegexIntSuf, function(x) { return parseInt(x, 16); }, token_int,
  kRegexIntOct, kRegexIntSuf, function(x) { return parseInt(x,  8); }, token_int,
  kRegexIntDec, kRegexIntSuf, function(x) { return parseInt(x, 10); }, token_int,
];

// We aren't going to really get this right, but this is some c/c++/c++11
// that should sort of get some of the obvious ones.
/** @const */ var kCTypeQualifiers = ['signed', 'unsigned', 'short', 'long'];
/** @const */ var kCTypes = ['bool', 'char', 'int', 'float', 'double',
                             'wchar_t', 'char16_t', 'char32_t',
                             '_Bool', 'float_t', 'double_t',
                             'int8_t, uint8_t', 'int16_t, uint16_t',
                             'int32_t, uint32_t', 'int64_t, uint64_t',
                             'intptr_t, uintptr_t', 'size_t', 'ssize_t', 'ptrdiff_t'];

/** @constructor */
function CLexer(str) {
  var p = 0;
  var len = str.length;

  function lex_single_token() {
    if (p >= len) throw "Unexpected end of input";

    var c;

    // Generic table dispatch for 3,2,1 length tokens.
    for (var sublen = 3; sublen > 0; --sublen) {
      if (p+sublen <= len) {
        c = str.substr(p, sublen);
        var c_func = kCOperatorTable[c];
        if (c_func !== undefined) {
          p += sublen; return c_func(c);
        }
      }
    }

    // c is str[p] as set from the loop above.

    // Special handling for complicated single character tokens.
    switch (c) {
      case ")": case ']':
        ++p; return { token_type: c };  // Handled by ( / [ below.
      case "(":
        ++p;
        // Try to directly handle typecasts of the form (type exp).
        var peek = peek_token();
        if (peek && peek.token_type === 'sym' &&
            (kCTypeQualifiers.indexOf(peek.left) !== -1 ||
             kCTypes.indexOf(peek.left) !== -1)) {
          var types = [ ];

          var seen_star = false;
          var seen_qualifer = false;
          var seen_type = false;

          while (true) {
            var t = lex_single_token();
            if (is_whitespace_token(t)) continue;
            if (t.token_type === ')') break;

            if (t.token_type === 'op_b' && t.op_str === '*') {
              if (seen_qualifer === false && seen_type === false)
                throw "* in typecast before any type";
              types.push('*');
              seen_star = true;
              continue;
            }

            if (t.token_type === 'sym' &&
                kCTypeQualifiers.indexOf(t.left) !== -1) {
              if (seen_type === true)
                throw "Typecast qualifier after a type";
              if (seen_star === true)
                throw "Typecast qualifier after a *";
              types.push(t.left);
              seen_qualifier = true;
              continue;
            }

            if (t.token_type === 'sym' &&
                kCTypes.indexOf(t.left) !== -1) {
              if (seen_type === true)
                throw "Typecast type after another type";
              if (seen_star === true)
                throw "Typecast type after a *";
              types.push(t.left);
              seen_type = true;
              continue;
            }

            throw 'Unexpected non-typey symbol in typecast: ' + t.token_type;
          }
          return token_typecast(types.join(' '));
        }

        return {
          token_type: '_paren',  // Shouldn't actually end up in the tree.
          lprec: 2,  // Function call
          led: function(left, s) {
            var e = null;
            if (s.token.token_type !== ')')
              e = s.expression(kMaxPrecedence, s);
            if (s.token.token_type !== ')')
              throw "Unmatched left parenthesis";
            s.advance();  // Advance over ')'.
            return {
              token_type: 'fun',
              lprec: 2,
              prec: 2,
              assoc: 'left',
              left: left,
              right: e};
          },
          nud: function(s) {
            if (s.token.token_type === ')')
              throw "Empty parentheses expression";
            var e = s.expression(kMaxPrecedence, s);
            if (s.token.token_type !== ')')
              throw "Unmatched left parenthesis";
            s.advance();  // Advance over ')'.
            return e;  // Insert the expression not the paren into the tree.
          }
        };
      case '[':
        ++p;
        return {
          token_type: 'op_b[]',
          lprec: 2,
          assoc: 'left',
          led: function(left, s) {
            this.prec = 2;
            if (s.token.token_type === ']')
              throw "Empty subscript";
            var e = s.expression(kMaxPrecedence, s);
            if (s.token.token_type !== ']')
              throw "Unmatched left bracket";
            s.advance();  // Advance over ']'.
            this.left = left;
            this.right = e;
            return this;
          },
          nud: invalid_nud,
        };
      case ":":
        ++p; return {token_type: ':'};  // Handled below.
      case "?":
        ++p;
        return {
          token_type: 'op_t',
          op_str: '?:',
          assoc: 'right',
          lprec: 15,
          led: function(left, s) {
            this.prec = 15;
            this.left = left;
            this.middle = s.expression(kMaxPrecedence-1, s);
            if (s.token.token_type !== ':')
              throw "Unmatched : for ?.";
            s.advance();  // Advance over ':';
            this.right = s.expression(kMaxPrecedence-1, s);
            return this;
          },
          nud: invalid_nud,
        };
        return token_op_right(c, 15, 0);
      default:
        // fall through and out.
    }

    var match;

    // Process numbers.
    // TODO(deanm): Performance of string slicing?
    for (var j = 3, jl = kNumberLexers.length; j < jl; j += 4) {
      var reg = kNumberLexers[j-3];

      if ((match = str.slice(p).match(reg)) === null) continue;

      var suf_reg = kNumberLexers[j-2];
      var valfunc = kNumberLexers[j-1];
      var token_create = kNumberLexers[j];

      var suffix = '';
      var val = valfunc(match[0]);
      p += match[0].length;
      if ((match = str.slice(p).match(suf_reg)) !== null) {
        suffix = match[0];
        p += suffix.length;
      }
      return token_create(val, suffix);
    }

    // Process identifiers.
    if ((match = str.slice(p).match(kRegexSym)) !== null) {
      var name = match[0];
      p += name.length;
      return token_sym(name);
    }

    throw "Failed in processing input: " + str.slice(p);
  }

  function peek_token() {
    var save_p = p;
    while (p < len) {
      var token = lex_single_token();
      if (is_whitespace_token(token)) continue;
      p = save_p;
      return token;
    }

    p = save_p;
    return null;
  }

  this.lex_token = function() {
    while (p < len) {
      var token = lex_single_token();
      if (!is_whitespace_token(token))
        return token;
    }
    return null;  // EOF
  }
}

function build_ast(lexer) {
  var end_token = {lprec: kMaxPrecedence, token_type: 'end'};
  var state = {
    token: end_token,
    at_end: function() { return this.token === end_token; },
    advance: function() {
      var t = lexer.lex_token();
      this.token = t === null ? end_token : t;
    },
    expression: function(rprec, s) {
      if (s.at_end()) return null;
      var t = s.token;
      s.advance();
      var left = t.nud(s);
      while (rprec > s.token.lprec) {
        t = s.token;
        s.advance();
        left = t.led(left, s);
      }
      return left;
    }
  };

  state.advance();  // get first token.

  var tree = state.expression(kMaxPrecedence-1, state);
  if (!state.at_end())
    throw "Trailing token: " + state.token.token_type;
  return tree;
}

try {  // CommonJS
  exports['CLexer'] = CLexer;
  exports['build_ast'] = build_ast;
} catch (e) { }
