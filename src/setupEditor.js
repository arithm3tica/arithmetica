var ace = require('brace');
require('brace/mode/javascript');
require('brace/theme/monokai');

module.exports = function setupEditor(name) {
        var editor = ace.edit(name);
        editor.setTheme("ace/theme/monokai");
        editor.session.setMode("ace/mode/javascript");
        editor.setOption("maxLines", 15);
        editor.setOption("minLines", 15);
        editor.insert('function foo(items) {\n'+
        '\tvar x = "All this is syntax highlighted";\n'+
        '\treturn x;\n'+
        '}');
        return editor;
}

