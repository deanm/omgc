/** @preserve (c) 2014 dean@gmail.com http://github.com/deanm/omgc */

var omgc = require('./omgc.js');
var bgen = require('./block_generator.js');

if (process.argv.length <= 2) {
  console.log('Usage: <c-expression>');
  process.exit(1);
}

function blocks_to_string(blocks, show_opt) {
  var out = [ ];
  for (var i = 0, il = blocks.length; i < il; ++i) {
    var b = blocks[i];
    if (show_opt !== true && b.opt === true)
      continue;
    out.push(b.text);
  }
  return out.join('');
}

var lexer = new omgc.CLexer(process.argv[2]);
try {
  var tree = omgc.build_ast(lexer);
  var blocks = bgen.generate_blocks(tree);
  console.log('Full Parentheses:');
  console.log('  ' + blocks_to_string(blocks, true));
  console.log('Minimal Parentheses:');
  console.log('  ' + blocks_to_string(blocks, false));
} catch (e) {
  console.log('Error: ' + e);
}
