/** @preserve (c) 2014 dean@gmail.com http://github.com/deanm/omgc */

// Generates a list of annotated text strings ("blocks") from an AST.

function gen_blocks_rec(depth, path, tree, prev, conf, blocks) {
  if (tree === null)  // Bad input, missing a child on an operator, etc.
    throw "Operator missing operand?";

  var ttype = tree.token_type;
  var paren = conf.pf(depth, path, tree, prev);
  ++depth;

  function paren_open() {
    if (paren !== -1)
      blocks.push({'type': '', 'text': '(', 'opt': paren === 0});
  }

  function paren_close() {
    if (paren !== -1)
      blocks.push({'type': '', 'text': ')', 'opt': paren === 0});
  }

  switch (ttype) {
    case 'num':
      // NOTE: Could also format tree.left, which is the numeric
      // value.  However it's nicer to get out exactly what came in,
      // which also includes the suffix, etc.
      var text = tree.raw;
      var desc = tree.num_type === 'flt' ?
                 'floating point number' : 'integer number';
      blocks.push({'type': 'num', 'desc': desc, 'text': text});
      break;
    case 'sym':
      blocks.push({'type': 'sym', 'desc': 'identifier', 'text': tree.left});
      break;
    case 'typespec':
      // Should only be reached through sizeof, typecast is handled without
      // recursing down to the typespec node.
      if (prev.token_type !== 'op_u' || prev.op_str !== 'sizeof')
        throw 'Cannot use type in expression: ' + tree.left;
      blocks.push({'type': '', 'text': '('});
      blocks.push({'type': 'typespec', 'desc': 'type', 'text': tree.left});
      blocks.push({'type': '', 'text': ')'});
      break;
    case 'fun':
      var p = [null, null, null, null];
      var desc = 'binary operator function call';
      var b0 = {'type': 'op_u', 'text': '(', 'desc': desc, 'p': p};
      var b1 = {'type': 'op_u', 'text': ')', 'desc': desc, 'p': p};
      paren_open();
      p[0] = blocks.length;
      var text = gen_blocks_rec(depth, 'left', tree.left, tree, conf, blocks);
      p[1] = blocks.length;
      blocks.push(b0);
      p[2] = blocks.length;
      if (tree.right !== null)  // Null when zero parameters.
        gen_blocks_rec(depth, 'fun', tree.right, tree, conf, blocks);
      p[3] = blocks.length;
      blocks.push(b1);
      paren_close();
      break;
    case 'op_b[]':
      paren_open();
      var p = [null, null, null, null];
      var desc = 'binary operator subscript';
      var b0 = {'type': 'op_u', 'text': '[', 'desc': desc, 'p': p};
      var b1 = {'type': 'op_u', 'text': ']', 'desc': desc, 'p': p};
      p[0] = blocks.length;
      var text = gen_blocks_rec(depth, 'left', tree.left, tree, conf, blocks);
      p[1] = blocks.length;
      blocks.push(b0);
      p[2] = blocks.length;
      gen_blocks_rec(depth, 'subscript', tree.right, tree, conf, blocks);
      p[3] = blocks.length;
      blocks.push(b1);
      paren_close();
      break;
    case 'op_u_typecast':
      if (tree.left.token_type !== 'typespec')
        throw "Typecast's left is not a typespec node";
      paren_open();
      var p = [null, null, null, null];
      var desc = 'unary operator typecast';
      // Don't recurse into the 'type' handling, we want to consider the
      // whole (type) as the operator.
      var text = '(' + tree.left.left + ')';
      var b0 = {'type': 'op_u', 'text': text, 'desc': desc, 'p': p};
      p[0] = blocks.length;
      blocks.push(b0);
      p[1] = blocks.length;
      p[2] = blocks.length;
      gen_blocks_rec(depth, 'typecast', tree.right, tree, conf, blocks);
      p[3] = blocks.length;
      paren_close();
      break;
    case 'op_u': case 'op_u_s':
      var desc = tree.assoc + ' associative ' +
                 (ttype === 'op_u' ? 'prefix' : 'postfix') +
                 ' unary operator ' + tree.op_str;
      var text = tree.op_str;
      if (text === 'sizeof') text += ' ';
      var b = {'type': ttype, 'text': text, 'desc': desc, 'p': [null, null]};
      paren_open();
      if (ttype === 'op_u') blocks.push(b);
      b['p'][0] = blocks.length;
      gen_blocks_rec(depth, ttype === 'op_u' ? 'right' : 'left', tree.left, tree, conf, blocks);
      b['p'][1] = blocks.length;
      if (ttype === 'op_u_s') blocks.push(b);
      paren_close();
      break;
    case 'op_b':
      var desc = tree.assoc + ' associative binary operator ' + tree.op_str;
      paren_open();
      var s0 = ' ', s1 = ' ';
      if (tree.op_str === '.' || tree.op_str === '->') s0 = s1 = '';
      if (tree.op_str === ',') s0 = '';
      var b = {'type': 'op_b', 'text': s0 + tree.op_str + s1,
               'desc': desc, 'p': [null, null, null, null]};
      b['p'][0] = blocks.length;
      gen_blocks_rec(depth, 'left', tree.left, tree, conf, blocks);
      b['p'][1] = blocks.length;
      blocks.push(b);
      b['p'][2] = blocks.length;
      gen_blocks_rec(depth, 'right', tree.right, tree, conf, blocks);
      b['p'][3] = blocks.length;
      paren_close();
      break;
    case 'op_t':
      var desc = 'right associative ternary operator ?:';
      var p = [null, null, null, null, null, null];
      var b0 = {'type': 'op_t', 'text': ' ? ', 'desc': desc, 'p': p};
      var b1 = {'type': 'op_t', 'text': ' : ', 'desc': desc, 'p': p};
      paren_open();
      p[0] = blocks.length;
      gen_blocks_rec(depth, 'left', tree.left, tree, conf, blocks);
      p[1] = blocks.length;
      blocks.push(b0);
      p[2] = blocks.length;
      gen_blocks_rec(depth, 'middle', tree.middle, tree, conf, blocks);
      p[3] = blocks.length;
      blocks.push(b1);
      p[4] = blocks.length;
      gen_blocks_rec(depth, 'right', tree.right, tree, conf, blocks);
      p[5] = blocks.length;
      paren_close();
      break;
    default:
      throw "Unknown node: " + tree.token_type;
  }
}

function generate_blocks(tree) {

  function minimal_pf(depth, path, cur, prev) {
    if (path === 'fun' || depth === 0) return -1;
    if (path === 'subscript') return 0;

    // ',' has highest precedence, don't think a((1, 2), 3) is valid anyway.
    if (prev.token_type === 'op_b' && prev.op_str === ',') return -1;

    if (cur.prec < prev.prec)
      return 0;
    if (path === 'right' && prev.assoc === 'right' && cur.prec <= prev.prec)
      return 0;
    if (path === 'left' && prev.assoc === 'left' && cur.prec <= prev.prec)
      return 0;

    return 1;
  }
  
  var blocks = [ ];
  var conf = {pf : minimal_pf};
  gen_blocks_rec(0, 'root', tree, null, conf, blocks);
  return blocks;
}

try {  // CommonJS
  exports['generate_blocks'] = generate_blocks;
} catch (e) { }
