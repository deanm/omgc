/** @preserve (c) 2014 dean@gmail.com http://github.com/deanm/omgc */

var omgc = require('./omgc.js');
var bgen = require('./block_generator.js');

function expr_to_string(expr, hide_opt) {
  var lexer = new omgc.CLexer(expr);
  var tree = omgc.build_ast(lexer);
  var blocks = bgen.generate_blocks(tree);
  var out = [ ];
  for (var i = 0, il = blocks.length; i < il; ++i) {
    var b = blocks[i];
    if (hide_opt === true && b.opt === true)
      continue;
    out.push(b.text);
  }
  return out.join('');
}

function assert_eq(a, b) {
  if (a !== b) {
    var m = 'assert_eq: ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b);
    console.trace(m); throw m;
  }
}

function assert_throws(estr, cb) {
  try {
    cb();
  } catch(e) {
    assert_eq(estr, e.toString());
    return;
  }
  throw 'Expected an exception.';
}

function test_basic() {
  assert_eq(
    "((1 + (2 / 3)) + (((3 + 4) / 5) * 6e-2)) + 0xf",
    expr_to_string("1 + 2 / 3 + (3 + 4) / 5 * 6e-2 + 0xf"))
}

function test_ternary() {
  assert_eq(
    "a ? b : (c ? d : e)",
    expr_to_string("a ? b : c ? d : e"));
  assert_eq(
    "(a ? b : c) ? d : e",
    expr_to_string("(a ? b : c) ? d : e"));
  assert_eq(
    "a ? (b ? c : d) : e",
    expr_to_string("a ? b ? c : d : e"));
  assert_eq(
    "f(a ? b : c, d)",
    expr_to_string("f(a ? b : c, d)"));
  assert_eq(
    "f((a ? b : c) = d)",
    expr_to_string("f(a ? b : c = d)"));
  assert_eq(
    "a ? ((b++), c) : d",
    expr_to_string("a ? b++, c : d"));
  assert_throws("Unmatched : for ?", function() {
    expr_to_string("a ?");
  });
  assert_throws("Operator missing operand?", function() {
    expr_to_string("a ? b :");
  });
  assert_throws("Unexpected (nud) encounter of token type: ':'", function() {
    expr_to_string("a ? : c");
  });
  assert_throws("Unexpected (nud) encounter of token type: 'op_t'", function() {
    expr_to_string(" ? b : c");
  });
}

function test_func() {
  assert_eq(
    "(((a.b)->c).d)()",
    expr_to_string("a.b->c.d()"));
  assert_eq(
    "(((a.b)->c).d)(1, 2, 3, e())",
    expr_to_string("a.b->c.d(1, 2, 3, e())"));
  assert_eq(
    "a()",
    expr_to_string("a()"));
  assert_eq(
    "a(1, 2)",
    expr_to_string("a(1, 2)"));
  assert_eq(
    "a(1 + 2, 2 + 3)",
    expr_to_string("a(1+2, 2+3)"));
  assert_eq(
    "a((1, 2))",
    expr_to_string("a((1,2))"));
  assert_throws("Unmatched left parenthesis", function() {
    expr_to_string("c(");
  });
  assert_throws("Unexpected (nud) encounter of token type: ')'", function() {
    expr_to_string("c(1,)");
  });
}

function test_subscript() {
  assert_eq(
    "a[1]",
    expr_to_string("a[1]"));
  assert_eq(
    "a[(1 + 2)]",
    expr_to_string("a[1+2]"));
  assert_eq(
    "a[((1 + 2) + (b[(c())]))]",
    expr_to_string("a[1 + 2 + b[c()]]"));
  assert_throws("Unmatched left bracket", function() {
    expr_to_string("a[");
  });
  assert_throws("Empty subscript", function() {
    expr_to_string("a[]");
  });
}

function test_sizeof() {
  assert_eq(
    "sizeof sizeofnot",
    expr_to_string("sizeof sizeofnot"));
  assert_eq(
    "(sizeof a) + 2",
    expr_to_string("sizeof(a) + 2"));
}

function test_typespec() {
  assert_eq(
    "sizeof (int)",
    expr_to_string("sizeof (int)"));
  assert_eq(
    "sizeof (int *)",
    expr_to_string("sizeof (int*)"));
  assert_eq(
    "sizeof (int * *)",
    expr_to_string("sizeof (int**)"));
  assert_eq(
    "((int)a) + 2",
    expr_to_string("(int)(a) + 2"));
  assert_eq(
    "((int *)a) + 2",
    expr_to_string("(int*)(a) + 2"));
  assert_eq(
    "(sizeof (*a)) + 2",
    expr_to_string("sizeof *a + 2"));
  assert_eq(
    "(sizeof (&a)) + 2",
    expr_to_string("sizeof &a + 2"));
  assert_throws("Cannot use type in expression: int", function() {
    expr_to_string("a + int");
  });
  assert_throws("Cannot use type in expression: int", function() {
    expr_to_string("sizeof int");
  });
  assert_eq(
    "sizeof a",
    expr_to_string("sizeof((a))"));
  // TODO Better/more specific exception message.
  assert_throws("Unexpected (nud) encounter of token type: ')'", function() {
    expr_to_string("sizeof((int))");
  });
  assert_throws("Cannot use type in expression: int", function() {
    expr_to_string("int");
  });
}

function test_comma() {
  assert_eq(
    "(a = 1), (b = 2)",
    expr_to_string("a = 1, b = 2"));
  assert_eq(
    "c(((a = 1), (b = 2)))",
    expr_to_string("c((a = 1, b = 2))"));
  assert_eq(
    "c = ((1, 2), 3)",
    expr_to_string("c = (1, 2, 3)"));
};

test_basic();
test_ternary();
test_func();
test_subscript();
test_sizeof();
test_typespec();
test_comma();
